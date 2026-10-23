// Browser-only service fixture: every auth/database/WebSocket request is intercepted.
// No real credentials and no writes to the deployed Supabase project.
const empty=baseline=>({version:2,baseline,statuses:{},logs:{},order:[],visits:{},history:[]});
const users={WXY:'00000000-0000-4000-8000-000000000001',LHJ:'00000000-0000-4000-8000-000000000002'};
const room='00000000-0000-4000-8000-000000000010';
export async function mockSharing(page,{loggedIn=true,preferLocalSnapshot=false,delayMs=0,initialIdentity='WXY',snapshots={}}={}){
  let identity=initialIdentity;const states={WXY:empty('source'),LHJ:empty('empty'),...structuredClone(snapshots)};let revision=1;const sockets=[];
  const session=name=>{
    const user={id:users[name],email:`${name.toLowerCase()}@beli.example.com`,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-22T00:00:00Z'};
    const exp=Math.floor(Date.now()/1000)+86400;
    const jwt=[{alg:'HS256',typ:'JWT'},{sub:user.id,role:'authenticated',exp,email:user.email}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.test-signature';
    return{access_token:jwt,refresh_token:'browser-fixture-refresh',expires_in:86400,expires_at:exp,token_type:'bearer',user};
  };
  if(loggedIn)await page.addInitScript(value=>{localStorage.setItem('sb-avxxytxplxqfkofqchrn-auth-token',JSON.stringify(value));},session(initialIdentity));
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
    const connection={socket,topic:'',bindings:[],active:true,array:false,joinRef:null};sockets.push(connection);socket.onClose(()=>{connection.active=false;});
    // realtime-js 2.x may use the v2 array frame [join_ref, ref, topic, event, payload] or the v1 object frame.
    socket.onMessage(raw=>{
      const parsed=JSON.parse(String(raw));const array=Array.isArray(parsed);
      const message=array?{join_ref:parsed[0],ref:parsed[1],topic:parsed[2],event:parsed[3],payload:parsed[4]}:parsed;
      const reply=(topic,payload,ref)=>socket.send(JSON.stringify(array?[message.join_ref,ref,topic,'phx_reply',payload]:{topic,event:'phx_reply',payload,ref}));
      if(message.event==='phx_join'){const bindings=(message.payload.config?.postgres_changes||[]).map((entry,id)=>({...entry,id:id+1}));Object.assign(connection,{topic:message.topic,bindings,array,joinRef:message.join_ref});reply(message.topic,{status:'ok',response:{postgres_changes:bindings}},message.ref);}
      if(message.event==='heartbeat')reply('phoenix',{status:'ok',response:{}},message.ref);
    });
  });
  return {async publishSnapshot(name,snapshot){for(let i=0;i<100&&!sockets.some(c=>c.active&&c.bindings.some(b=>b.table==='beli_states'));i++)await new Promise(resolve=>setTimeout(resolve,10));await new Promise(resolve=>setTimeout(resolve,100));states[name]=structuredClone(snapshot);for(const {socket,topic,bindings,array,joinRef} of sockets.filter(c=>c.active)){const ids=bindings.filter(b=>b.table==='beli_states').map(b=>b.id);if(ids.length){const payload={ids,data:{schema:'public',table:'beli_states',type:'UPDATE',commit_timestamp:new Date().toISOString(),columns:[],record:{user_id:users[name],payload:states[name],revision:++revision},old_record:{}}};socket.send(JSON.stringify(array?[joinRef,null,topic,'postgres_changes',payload]:{topic,event:'postgres_changes',payload}));};}}};
}
