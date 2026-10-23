// Real service checks. Password comes only from the caller's environment.
// Creates the requested two-person room if absent; preserves existing snapshots.
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
process.loadEnvFile('.env.production');
if(!process.env.CLOUD_TEST_PASSWORD)throw new Error('CLOUD_TEST_PASSWORD is required');
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const make=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const a=make(),b=make(),anon=make();const passed=[];
const check=(error)=>{if(error)throw new Error(error.message);};
let path,channel,temporaryWant,space;
try{
  const users=[];
  for(const [name,client] of [['WXY',a],['LHJ',b]]){
    const {data,error}=await client.auth.signInWithPassword({email:`${name.toLowerCase()}@beli.example.com`,password:process.env.CLOUD_TEST_PASSWORD});check(error);users.push(data.user);passed.push(`${name} real password login`);
  }
  const [ua,ub]=users;
  const own=await a.from('beli_members').select('space_id').eq('user_id',ua.id).maybeSingle();check(own.error);
  space=own.data?.space_id;
  if(!space){const created=await a.rpc('beli_create_space',{member_name:'WXY'});check(created.error);space=created.data.id;}
  const partner=await b.from('beli_members').select('space_id').eq('user_id',ub.id).maybeSingle();check(partner.error);
  if(!partner.data){const invite=await a.rpc('beli_rotate_invite',{target_space:space});check(invite.error);const joined=await b.rpc('beli_join_space',{invite_token:invite.data,member_name:'LHJ'});check(joined.error);}else assert.equal(partner.data.space_id,space,'Accounts already belong to different rooms; do not alter them');
  const members=await a.from('beli_members').select('user_id,display_name,avatar_letter').eq('space_id',space);check(members.error);assert.equal(members.data.length,2);assert.equal(members.data.find(m=>m.user_id===ua.id).avatar_letter,'W');assert.equal(members.data.find(m=>m.user_id===ub.id).avatar_letter,'L');passed.push('two members in one room, W/L avatars');
  for(const [client,user,baseline] of [[a,ua,'source'],[b,ub,'empty']]){
    const old=await client.from('beli_states').select('payload,revision').eq('user_id',user.id).maybeSingle();check(old.error);
    const payload=old.data?.payload||{version:2,baseline,statuses:{},logs:{},order:[],visits:{},history:[]};
    const saved=await client.rpc('beli_save_state',{target_space:space,state_payload:payload,expected_revision:old.data?.revision||0});check(saved.error);
    const stale=await client.rpc('beli_save_state',{target_space:space,state_payload:payload,expected_revision:saved.data-1});assert(stale.error?.message.includes('SYNC_CONFLICT'));
  }
  passed.push('own snapshot persistence, existing records preserved, stale revision rejected');
  const cross=await b.from('beli_states').update({payload:{version:2}}).eq('user_id',ua.id);assert(cross.error,'direct cross-user overwrite must fail');
  const crossInsert=await b.from('beli_states').insert({space_id:space,user_id:ua.id,payload:{version:2}});assert(crossInsert.error);
  const outside=await b.rpc('beli_save_state',{target_space:crypto.randomUUID(),state_payload:{version:2},expected_revision:0});assert(outside.error?.message.includes('MEMBER_REQUIRED'));
  const publicRead=await anon.from('beli_spaces').select('*');assert(publicRead.error);passed.push('anonymous read denied, cross-user update/insert denied, non-member RPC denied');
  const ids=JSON.parse(fs.readFileSync('src/data/restaurants.generated.json','utf8')).restaurants.map(r=>r.id);
  const wants=await a.from('beli_wants').select('restaurant_id').eq('space_id',space);check(wants.error);
  const restaurant=ids.find(id=>!wants.data.some(w=>w.restaurant_id===id));assert(restaurant);
  let received=false;await a.realtime.setAuth((await a.auth.getSession()).data.session.access_token);
  channel=a.channel(`audit-${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'beli_wants',filter:`space_id=eq.${space}`},payload=>{if(payload.new.restaurant_id===restaurant)received=true;});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Realtime subscribe timeout')),15000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}else if(status==='CHANNEL_ERROR'){clearTimeout(timeout);reject(new Error('Realtime channel error'));}});});
  const add=await b.from('beli_wants').insert({space_id:space,restaurant_id:restaurant,added_by:ub.id});check(add.error);temporaryWant=restaurant;
  for(let i=0;i<30&&!received;i++)await new Promise(resolve=>setTimeout(resolve,250));assert(received,'Realtime event not received');
  const shared=await a.from('beli_wants').select('restaurant_id').eq('space_id',space).eq('restaurant_id',restaurant);check(shared.error);assert.equal(shared.data.length,1);passed.push('shared wishlist visible to partner, real Realtime event received');
  path=`${space}/${ua.id}/${crypto.randomUUID()}`;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHd8AAAAASUVORK5CYII=','base64');
  check((await a.storage.from('beli-photos').upload(path,png,{contentType:'image/png'})).error);
  const read=await b.storage.from('beli-photos').download(path);check(read.error);assert.equal(read.data.size,png.length);
  assert((await anon.storage.from('beli-photos').download(path)).error);
  assert((await b.storage.from('beli-photos').upload(path,png,{upsert:true,contentType:'image/png'})).error);
  await b.storage.from('beli-photos').remove([path]);check((await a.storage.from('beli-photos').download(path)).error);
  passed.push('private photo upload, member download, anonymous denial, partner cannot overwrite/delete owner photo');
  const report={testedAt:new Date().toISOString(),passed,limitations:['Third authenticated non-member account not created; membership denial exercised against a different room ID.','Snapshots keep existing contents; no fabricated visits or scores added.']};
  fs.writeFileSync('qa/cloud-service-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{
  if(temporaryWant)check((await b.from('beli_wants').delete().eq('space_id',space).eq('restaurant_id',temporaryWant)).error);
  if(path)check((await a.storage.from('beli-photos').remove([path])).error);
  if(channel)await a.removeChannel(channel);
  await Promise.all([a.auth.signOut({scope:'local'}),b.auth.signOut({scope:'local'})]);
  a.realtime.disconnect();b.realtime.disconnect();anon.realtime.disconnect();
}
