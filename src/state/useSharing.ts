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
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [invite,setInvite]=useState(()=>sessionStorage.getItem('beli-invite') || '');
  const [tick,setTick]=useState(0);
  const revision=useRef(0);const lastSynced=useRef('');const queue=useRef(Promise.resolve());const conflict=useRef(false);
  const restore=food.restore;
  const photoTransfer=useCallback(async(payload:FoodSnapshot,sid:string,uid:string,upload:boolean)=>{
    if(!client)return;
    for(const id of new Set([...Object.values(payload.logs),...Object.values(payload.visits || {}).flat()].flatMap(log=>log.photoIds))){
      const path=`${sid}/${uid}/${id}`;const blob=await readPhoto(id);
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
    setMembers((results[0].data||[]) as unknown as Member[]);setStates(cleanRows);setWants((results[2].data||[]) as unknown as SharedWant[]);
    return cleanRows;
  },[]);
  const loadSpace=useCallback(async(uid:string)=>{
    if(!client)return;setReady(false);setError('');
    try{
      const {data:membership,error}=await client.from('beli_members').select('space_id').eq('user_id',uid).maybeSingle();if(error)throw error;
      if(!membership){setSpace(null);setMembers([]);return;}
      const {data,error:spaceError}=await client.from('beli_spaces').select('id,name,owner_id').eq('id',membership.space_id).single();if(spaceError)throw spaceError;
      const room=data as Space;setSpace(room);const rows=await refresh(room.id);const own=rows?.find(r=>r.user_id===uid);
      if(own){await photoTransfer(own.payload,room.id,uid,false);try{localStorage.setItem('beli-before-cloud-backup',JSON.stringify(food.snapshot));}catch{/* no overwrite of cloud data */}restore(own.payload);lastSynced.current=JSON.stringify(own.payload);revision.current=own.revision;}
      else{revision.current=0;lastSynced.current='';if(room.owner_id!==uid)restore(emptySnapshot('empty'));}
      conflict.current=false;setStatus(own?'已同步':'准备首次同步');setReady(true);
    }catch(err){setError(err instanceof Error?err.message:'连接失败');}
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
    const channel=client.channel(`space-${space.id}`).on('postgres_changes',{event:'*',schema:'public',table:'beli_states',filter:`space_id=eq.${space.id}`},()=>{void refresh(space.id).catch(()=>{});}).on('postgres_changes',{event:'*',schema:'public',table:'beli_wants',filter:`space_id=eq.${space.id}`},()=>{void refresh(space.id).catch(()=>{});}).on('postgres_changes',{event:'*',schema:'public',table:'beli_members',filter:`space_id=eq.${space.id}`},()=>{void refresh(space.id).catch(()=>{});}).subscribe();
    return()=>{void client?.removeChannel(channel);};
  },[space,refresh]);
  useEffect(()=>{
    if(!client||!space||!userId||!ready)return;
    const payload=food.snapshot;const json=JSON.stringify(payload);if(json===lastSynced.current)return;
    const timer=setTimeout(()=>{queue.current=queue.current.then(async()=>{
      if(!client||conflict.current||json===lastSynced.current)return;setStatus('正在同步');setError('');
      try{await photoTransfer(payload,space.id,userId,true);const {data,error}=await client.rpc('beli_save_state',{target_space:space.id,state_payload:payload,expected_revision:revision.current});if(error)throw error;revision.current=Number(data);lastSynced.current=json;setStatus('已同步');await refresh(space.id);}
      catch(err){const message=err instanceof Error?err.message:String((err as {message?:string})?.message||'同步失败');if(message.includes('SYNC_CONFLICT')){conflict.current=true;setReady(false);setError('另一台设备已有更新，请先载入云端记录。');}else setError(message);setStatus('同步未完成');}
    });},700);return()=>clearTimeout(timer);
  },[food.snapshot,space,userId,ready,tick,photoTransfer,refresh]);
  const signIn=async(name:IdentityName,password:string)=>{if(!client)return;const identity=identities.find(item=>item.name===name);if(!identity)throw new Error('请选择身份');const {error}=await client.auth.signInWithPassword({email:identity.email,password});if(error)throw new Error((error.code==='invalid_credentials'||/invalid login credentials/i.test(error.message))?'密码不正确，请重试':'暂时无法登录，请稍后重试');};
  const changePassword=async(password:string)=>{if(!client)return;const {error}=await client.auth.updateUser({password});if(error)throw error;};
  const updateName=async(name:string)=>{if(!client||!space)return;const {error}=await client.rpc('beli_update_name',{member_name:name});if(error)throw error;await refresh(space.id);};
  const sendLink=async(email:string)=>{if(!client)return;const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+import.meta.env.BASE_URL}});if(error)throw error;setStatus('登录链接已发送，请查收邮件');};
  const create=async(name:string)=>{if(!client||!userId)return;const {data,error}=await client.rpc('beli_create_space',{member_name:name});if(error)throw error;setInvite(data.invite);sessionStorage.setItem('beli-invite',data.invite);await loadSpace(userId);};
  const join=async(token:string,name:string)=>{if(!client||!userId)return;const {error}=await client.rpc('beli_join_space',{invite_token:token.trim(),member_name:name});if(error)throw error;sessionStorage.removeItem('beli-invite');setInvite('');await loadSpace(userId);};
  const inviteLink=async()=>{if(!client||!space)return '';const {data,error}=await client.rpc('beli_rotate_invite',{target_space:space.id});if(error)throw error;const link=`${location.origin}${import.meta.env.BASE_URL}#/join/${data}`;await navigator.clipboard.writeText(link);return link;};
  const toggleWant=async(id:string)=>{if(!client||!space||!userId)return;const exists=wants.some(row=>row.restaurant_id===id);const result=exists?await client.from('beli_wants').delete().eq('space_id',space.id).eq('restaurant_id',id):await client.from('beli_wants').insert({space_id:space.id,restaurant_id:id,added_by:userId});if(result.error)throw result.error;await refresh(space.id);};
  return{configured:!!client,userId,accountName,space,members,states,wants,status,error,invite,ready,signIn,changePassword,updateName,sendLink,create,join,inviteLink,toggleWant,retry:()=>setTick(v=>v+1),reloadCloud:()=>userId?loadSpace(userId):Promise.resolve(),signOut:async()=>{await client?.auth.signOut();}};
}
export type SharingController=ReturnType<typeof useSharing>;
