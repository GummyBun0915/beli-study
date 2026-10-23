import { useCallback, useEffect, useRef, useState } from 'react';
import { sharedClient as client } from './sharedClient';
import { identities, identityForEmail, type IdentityName } from './identities';
import { cachePhoto, readPhoto } from './photos';
import { restaurants } from '../data/restaurants';
import { emptySnapshot, normalizeSnapshot, type FoodSnapshot, type FoodStateController } from './useFoodState';

export interface Member { user_id: string; display_name: string; avatar_letter: string; avatar_color: string }
export interface SharedState { user_id: string; payload: FoodSnapshot; revision: number }
interface Space { id: string; name: string; owner_id: string }
interface SharedWant { restaurant_id: string; added_by: string }
export function useSharing(food: FoodStateController) {
  const [userId,setUserId]=useState<string|null>(null);
  const [accountName,setAccountName]=useState<string>('');
  const [space,setSpace]=useState<Space|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [states,setStates]=useState<SharedState[]>([]);
  const [wants,setWants]=useState<SharedWant[]>([]);
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(false);
  const [hasLocalBackup,setHasLocalBackup]=useState(false);
  const foodRef=useRef(food);foodRef.current=food;
  const identityEpoch=useRef(0);
  const [status,setStatus]=useState('');
  const [realtimeStatus,setRealtimeStatus]=useState('');
  const [error,setError]=useState('');
  const [invite,setInvite]=useState(()=>sessionStorage.getItem('beli-invite') || '');
  const [tick,setTick]=useState(0);
  const revision=useRef(0);const lastSynced=useRef('');const queue=useRef(Promise.resolve());const conflict=useRef(false);
  const restore=food.restore;
  const photoTransfer=useCallback(async(payload:FoodSnapshot,sid:string,uid:string,upload:boolean)=>{
    if(!client)return;
    for(const id of new Set([...Object.values(payload.logs),...Object.values(payload.visits || {}).flat()].flatMap(log=>log.photoIds))){
      const path=`${sid}/${uid}/${id}`;const blob=await readPhoto(id);
      if(upload&&!blob)throw new Error('本机缺少待同步照片，请先重新载入云端记录。');
      if(upload&&blob){const {error}=await client.storage.from('beli-photos').upload(path,blob,{upsert:false,contentType:blob.type});if(error&&error.statusCode!=='409')throw error;}
      if(!upload&&!blob){const {data,error}=await client.storage.from('beli-photos').download(path);if(error)throw error;if(data)await cachePhoto(id,data);}
    }
  },[]);
  const refresh=useCallback(async(sid:string)=>{
    if(!client)return;
    const results=await Promise.all([
      client.from('beli_members').select('user_id,display_name,avatar_letter,avatar_color').eq('space_id',sid),
      client.from('beli_states').select('user_id,payload,revision').eq('space_id',sid),
      client.from('beli_wants').select('restaurant_id,added_by').eq('space_id',sid),
    ]);
    for(const result of results)if(result.error)throw result.error;
    const cleanRows=((results[1].data||[]) as unknown as SharedState[]).map(row=>({...row,payload:normalizeSnapshot(row.payload,new Set(restaurants.map(r=>r.id)))}));
    await Promise.all(cleanRows.map(row=>photoTransfer(row.payload,sid,row.user_id,false)));
    setMembers((results[0].data||[]) as unknown as Member[]);setStates(cleanRows);setWants((results[2].data||[]) as unknown as SharedWant[]);
    return cleanRows;
  },[photoTransfer]);
  const loadSpace=useCallback(async(uid:string)=>{
    if(!client)return;setReady(false);setLoading(true);setError('');
    const epoch=++identityEpoch.current;
    try{
    const previousOwner=localStorage.getItem('beli-food-owner');
    let local=foodRef.current.snapshot;
    if(previousOwner!==uid){
      localStorage.setItem(`beli-food-cache:${previousOwner||'local'}`,JSON.stringify(local));
      const saved=localStorage.getItem(`beli-food-cache:${uid}`);
      const {data:session}=await client.auth.getSession();
      const name=identityForEmail(session.session?.user.email)?.name;
      local=saved?normalizeSnapshot(JSON.parse(saved),new Set(restaurants.map(r=>r.id))):name==='WXY'&&!previousOwner?local:emptySnapshot(name==='WXY'?'source':'empty');
      if(epoch!==identityEpoch.current)return;
      restore(local);localStorage.setItem('beli-food-owner',uid);
    }
      const {data:membership,error}=await client.from('beli_members').select('space_id').eq('user_id',uid).maybeSingle();if(error)throw error;
      if(epoch!==identityEpoch.current)return;
      if(!membership){setSpace(null);setMembers([]);return;}
      const {data,error:spaceError}=await client.from('beli_spaces').select('id,name,owner_id').eq('id',membership.space_id).single();if(spaceError)throw spaceError;
      if(epoch!==identityEpoch.current)return;
      const room=data as Space;setSpace(room);const rows=await refresh(room.id);if(epoch!==identityEpoch.current)return;const own=rows?.find(r=>r.user_id===uid);
      if(own){await photoTransfer(own.payload,room.id,uid,false);if(epoch!==identityEpoch.current)return;try{if(JSON.stringify(local)!==JSON.stringify(own.payload))localStorage.setItem(`beli-before-cloud-backup:${uid}`,JSON.stringify(local));setHasLocalBackup(!!localStorage.getItem(`beli-before-cloud-backup:${uid}`));}catch{/* no overwrite of cloud data */}restore(own.payload);lastSynced.current=JSON.stringify(own.payload);revision.current=own.revision;}
      else{revision.current=0;lastSynced.current='';if(room.owner_id!==uid)restore(emptySnapshot('empty'));}
      conflict.current=false;setStatus(own?'已同步':'准备首次同步');setReady(true);
    }catch(err){if(epoch===identityEpoch.current)setError(err instanceof Error?err.message:'连接失败');}
    finally{if(epoch===identityEpoch.current)setLoading(false);}
  // Only identity and explicit reloads load the cloud snapshot; local edits must never trigger a download.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[refresh,restore,photoTransfer]);
  useEffect(()=>{
    const hash=decodeURIComponent(location.hash);if(hash.startsWith('#/join/')){const token=hash.slice(7);sessionStorage.setItem('beli-invite',token);setInvite(token);location.hash='/profile';}
    if(!client)return;
    client.auth.getSession().then(({data})=>{setUserId(data.session?.user.id||null);setAccountName(identityForEmail(data.session?.user.email)?.name||'');});
    const {data}=client.auth.onAuthStateChange((_event,session)=>{setUserId(session?.user.id||null);setAccountName(identityForEmail(session?.user.email)?.name||'');});return()=>data.subscription.unsubscribe();
  },[]);
  useEffect(()=>{if(userId)void loadSpace(userId);else{setReady(false);setSpace(null);setMembers([]);setStates([]);setWants([]);}},[userId,loadSpace]);
  useEffect(()=>{
    if(!client||!space)return;
    let cancelled=false;let channel:ReturnType<typeof client.channel>|undefined;
    const update=()=>{void refresh(space.id).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'更新共享记录失败');});};
    void (async()=>{
      const {data}=await client.auth.getSession();if(cancelled||!data.session)return;
      // Auth's sign-in notification does not await Realtime's token update.
      await client.realtime.setAuth(data.session.access_token);if(cancelled)return;
      channel=client.channel(`space-${space.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'beli_states',filter:`space_id=eq.${space.id}`},update)
        .on('postgres_changes',{event:'*',schema:'public',table:'beli_wants',filter:`space_id=eq.${space.id}`},update)
        .on('postgres_changes',{event:'*',schema:'public',table:'beli_members',filter:`space_id=eq.${space.id}`},update)
        .subscribe(state=>{if(!cancelled)setRealtimeStatus(state==='SUBSCRIBED'?'':state==='CHANNEL_ERROR'||state==='TIMED_OUT'?'实时连接中断，定期刷新':'正在连接实时更新');});
    })().catch(()=>{if(!cancelled)setRealtimeStatus('实时连接中断，定期刷新');});
    const poll=window.setInterval(update,30000);window.addEventListener('focus',update);
    return()=>{cancelled=true;clearInterval(poll);window.removeEventListener('focus',update);if(channel)void client?.removeChannel(channel);};
  },[space,refresh]);
  useEffect(()=>{
    if(!client||!space||!userId||!ready)return;
    const epoch=identityEpoch.current;const payload=food.snapshot;const json=JSON.stringify(payload);if(json===lastSynced.current)return;
    const timer=setTimeout(()=>{queue.current=queue.current.then(async()=>{
      if(!client||epoch!==identityEpoch.current||conflict.current||json===lastSynced.current)return;setStatus('正在同步');setError('');
      try{await photoTransfer(payload,space.id,userId,true);if(epoch!==identityEpoch.current)return;const {data,error}=await client.rpc('beli_save_state',{target_space:space.id,state_payload:payload,expected_revision:revision.current});if(error)throw error;if(epoch!==identityEpoch.current)return;revision.current=Number(data);lastSynced.current=json;setStatus('已同步');await refresh(space.id);}
      catch(err){const message=err instanceof Error?err.message:String((err as {message?:string})?.message||'同步失败');if(message.includes('SYNC_CONFLICT')){conflict.current=true;setReady(false);setError('另一台设备已有更新，请先载入云端记录。');}else setError(message);setStatus('同步未完成');}
    });},700);return()=>clearTimeout(timer);
  },[food.snapshot,space,userId,ready,tick,photoTransfer,refresh]);
  const signIn=async(name:IdentityName,password:string)=>{if(!client)return;const identity=identities.find(item=>item.name===name);if(!identity)throw new Error('请选择身份');const {error}=await client.auth.signInWithPassword({email:identity.email,password});if(error)throw new Error((error.code==='invalid_credentials'||/invalid login credentials/i.test(error.message))?'密码不正确，请重试':'暂时无法登录，请稍后重试');};
  const changePassword=async(password:string)=>{if(!client)return;const {error}=await client.auth.updateUser({password});if(error)throw error;};
  const updateName=async(name:string)=>{if(!client||!space)return;const {error}=await client.rpc('beli_update_name',{member_name:name});if(error)throw error;await refresh(space.id);};
  const sendLink=async(email:string)=>{if(!client)return;const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+import.meta.env.BASE_URL}});if(error)throw error;setStatus('登录链接已发送，请查收邮件');};
  const create=async(name:string)=>{if(!client||!userId)return;const {data,error}=await client.rpc('beli_create_space',{member_name:name});if(error)throw error;setInvite(data.invite);sessionStorage.setItem('beli-invite',data.invite);await loadSpace(userId);};
  const join=async(token:string,name:string)=>{if(!client||!userId)return;let inviteToken=token.trim();if(inviteToken.includes('#/join/'))inviteToken=inviteToken.split('#/join/')[1].split(/[?&]/)[0];if(!/^[a-f0-9]{32}$/i.test(inviteToken))throw new Error('邀请码格式不正确，请粘贴完整邀请链接或邀请码');const {error}=await client.rpc('beli_join_space',{invite_token:inviteToken,member_name:name});if(error)throw error;sessionStorage.removeItem('beli-invite');setInvite('');await loadSpace(userId);};
  const inviteLink=async()=>{if(!client||!space)return '';const {data,error}=await client.rpc('beli_rotate_invite',{target_space:space.id});if(error)throw error;const link=`${location.origin}${import.meta.env.BASE_URL}#/join/${data}`;await navigator.clipboard.writeText(link);return link;};
  const toggleWant=async(id:string)=>{if(!client||!space||!userId)return;const exists=wants.some(row=>row.restaurant_id===id);const result=exists?await client.from('beli_wants').delete().eq('space_id',space.id).eq('restaurant_id',id):await client.from('beli_wants').insert({space_id:space.id,restaurant_id:id,added_by:userId});if(result.error)throw result.error;await refresh(space.id);};
  const downloadLocalBackup=()=>{if(!userId)return;const saved=localStorage.getItem(`beli-before-cloud-backup:${userId}`);if(!saved)return;const url=URL.createObjectURL(new Blob([saved],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`beli-${accountName||'records'}-backup.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return{configured:!!client,userId,accountName,space,members,states,wants,status:realtimeStatus||status,error,invite,ready,loading,hasLocalBackup,downloadLocalBackup,signIn,changePassword,updateName,sendLink,create,join,inviteLink,toggleWant,retry:()=>setTick(v=>v+1),reloadCloud:()=>userId?loadSpace(userId):Promise.resolve(),signOut:async()=>{identityEpoch.current++;setReady(false);const uid=userId;if(uid)localStorage.setItem(`beli-food-cache:${uid}`,JSON.stringify(foodRef.current.snapshot));await queue.current;await client?.auth.signOut({scope:'local'});restore(emptySnapshot('empty'));localStorage.removeItem('beli-food-owner');}};
}
export type SharingController=ReturnType<typeof useSharing>;
