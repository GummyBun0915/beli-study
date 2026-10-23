// Browser-only service fixture: every auth/database/WebSocket request is intercepted.
// No real credentials and no writes to the deployed Supabase project.
const empty=baseline=>({version:2,baseline,statuses:{},logs:{},order:[],visits:{},history:[]});
const users={WXY:'00000000-0000-4000-8000-000000000001',LHJ:'00000000-0000-4000-8000-000000000002'};
const room='00000000-0000-4000-8000-000000000010';
export async function mockSharing(page,{loggedIn=true,preferLocalSnapshot=false,delayMs=0}={}){
  let identity='WXY';const states={WXY:empty('source'),LHJ:empty('empty')};let revision=1;
  const session=name=>{
    const user={id:users[name],email:`${name.toLowerCase()}@beli.example.com`,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-22T00:00:00Z'};
    const exp=Math.floor(Date.now()/1000)+86400;
    const jwt=[{alg:'HS256',typ:'JWT'},{sub:user.id,role:'authenticated',exp,email:user.email}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.test-signature';
    return{access_token:jwt,refresh_token:'browser-fixture-refresh',expires_in:86400,expires_at:exp,token_type:'bearer',user};
  };
  if(loggedIn)await page.addInitScript(value=>{localStorage.setItem('sb-avxxytxplxqfkofqchrn-auth-token',JSON.stringify(value));},session('WXY'));
  await page.route('**/auth/v1/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/logout'))return route.fulfill({json:{}});
    const body=route.request().postDataJSON();identity=body?.email?.startsWith('lhj@')?'LHJ':'WXY';
    await route.fulfill({json:session(identity)});
  });
  await page.route('**/rest/v1/**',async route=>{
    const url=new URL(route.request().url());const table=url.pathname.split('/').at(-1);
    if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
    let result;
    if(table==='beli_members')result=url.searchParams.has('user_id')?{space_id:room}:Object.entries(users).map(([name,id])=>({user_id:id,display_name:name,avatar_letter:name[0],avatar_color:'#286ad7'}));
    else if(table==='beli_spaces')result={id:room,name:'Our dining list',owner_id:users.WXY};
    else if(table==='beli_states'){
      if(preferLocalSnapshot){const value=await page.evaluate(()=>localStorage.getItem('beli-dachitech:food-state:v2'));if(value)states[identity]=JSON.parse(value);}
      result=Object.entries(users).map(([name,id])=>({user_id:id,payload:states[name],revision}));
    }else if(table==='beli_wants')result=[];
    else if(table==='beli_save_state'){states[identity]=route.request().postDataJSON().state_payload;result=++revision;}
    else throw new Error(`Unmocked service request: ${table}`);
    await route.fulfill({json:result});
  });
  await page.routeWebSocket('**/realtime/v1/**',socket=>{
    socket.onMessage(raw=>{
      const message=JSON.parse(String(raw));
      if(message.event==='phx_join')socket.send(JSON.stringify({topic:message.topic,event:'phx_reply',payload:{status:'ok',response:{postgres_changes:(message.payload.config?.postgres_changes||[]).map((entry,id)=>({...entry,id}))}},ref:message.ref}));
      if(message.event==='heartbeat')socket.send(JSON.stringify({topic:'phoenix',event:'phx_reply',payload:{status:'ok',response:{}},ref:message.ref}));
    });
  });
}
