import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bookmark, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, CirclePlus, Clock3, Compass, Filter,
  Heart, List, Map as MapIcon, MapPin, Menu, Search, Share2,
  SlidersHorizontal, Sparkles, Star, Trophy, UserRound, UtensilsCrossed,
  X,
} from 'lucide-react';
import type { Restaurant } from './data/restaurants';
import { formattedVisitDate, imageUrl, mergePlaces, regionName, regions, restaurants, type PlaceRecord } from './data/restaurants';
import { useFoodState, type FoodStatus, type FoodStateController } from './state/useFoodState';
import { useSharing, type SharingController } from './state/useSharing';
import { LoginScreen, SessionScreen } from './components/LoginScreen';
import { SharedFeed } from './components/SharedFeed';
import { AddPlace } from './components/AddPlace';
import { SharingPanel } from './components/SharingPanel';
import { VisitTimeline } from './components/VisitTimeline';
import { RankingFlow } from './components/RankingFlow';
import { PhotoCarousel, PhotoViewer } from './components/PhotoGallery';
const MapPane = lazy(async () => ({ default: (await import('./components/MapPane')).MapPane }));

type Page = 'feed' | 'lists' | 'search' | 'rank' | 'profile' | 'detail';
type ListTab = 'been' | 'want' | 'recs' | 'guides';
type ListView = 'list' | 'map';
type SortMode = 'recent' | 'name' | 'score';

function initialRoute(): { page: Page; id: string | null } {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (hash.startsWith('/restaurant/')) return { page: 'detail', id: hash.split('/')[2] ?? null };
  const page = hash.replace(/^\//, '') as Page;
  return ['feed', 'lists', 'search', 'rank', 'profile'].includes(page)
    ? { page, id: null }
    : { page: 'feed', id: null };
}

function navTo(page: Page, id?: string) {
  window.location.hash = page === 'detail' && id ? `/restaurant/${encodeURIComponent(id)}` : `/${page}`;
}

const img = (r: Restaurant, className = '') => r.coverUrl
  ? <img className={className} src={r.coverUrl} alt={`${r.displayName} 实拍`} loading="lazy" style={{ objectPosition: r.images[0]?.pos ?? 'center' }} />
  : <div className={`${className} no-photo`}><UtensilsCrossed size={26} strokeWidth={1.5} /><span>暂无照片</span></div>;

function foodTags(r: Restaurant) {
  return r.cuisineTags.slice(0, 3).join(' · ') || '餐厅';
}

function InfoLine({ r }: { r: Restaurant }) {
  return <span className="info-line">{r.actualCity || regionName(r.regionSlug)}{r.cuisineTags.length ? ` · ${foodTags(r)}` : ''}{r.avgPrice ? ` · ¥${Math.round(r.avgPrice)}/人` : ''}</span>;
}

function BottomNav({ page }: { page: Page }) {
  const items: { page: Page; label: string; icon: typeof List }[] = [
    { page: 'feed', label: 'Feed', icon: List },
    { page: 'lists', label: 'Your Lists', icon: Bookmark },
    { page: 'search', label: 'Search', icon: CirclePlus },
    { page: 'rank', label: 'Leaderboard', icon: Trophy },
    { page: 'profile', label: 'Profile', icon: UserRound },
  ];
  return <nav className="bottom-nav" aria-label="主导航">
    {items.map(({ page: target, label, icon: Icon }) => <button key={target} className={page === target ? 'active' : ''} onClick={() => navTo(target)} aria-current={page === target ? 'page' : undefined}>
      <span className={`nav-icon ${target === 'search' ? 'nav-add' : ''}`}><Icon size={target === 'search' ? 25 : 21} strokeWidth={target === 'search' ? 2 : 1.8} /></span>
      <span>{label}</span>
    </button>)}
  </nav>;
}

function TopBar({ left, title, right }: { left?: React.ReactNode; title?: React.ReactNode; right?: React.ReactNode }) {
  return <header className="topbar"><div className="topbar-side">{left}</div><div className="topbar-title">{title}</div><div className="topbar-side right">{right}</div></header>;
}

function App() {
  const [route, setRoute] = useState(initialRoute);
  const [listTab, setListTab] = useState<ListTab>('been');
  const [listView, setListView] = useState<ListView>('list');
  const [city, setCity] = useState('shenzhen');
  const [cuisine, setCuisine] = useState('all');
  const [priceCap, setPriceCap] = useState<number | null>(null);
  const [photoOnly, setPhotoOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [query, setQuery] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [ratingMode, setRatingMode] = useState<'visit' | 'rerank'>('visit');
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [profileName, setProfileName] = useState(() => localStorage.getItem('beli-study-profile-name')?.replace(/^我的美食档案$/, 'WXY') || 'WXY');
  const [editingName, setEditingName] = useState(false);
  const food = useFoodState(restaurants);
  const sharing = useSharing(food);
  // Static catalogue + own places (inside food) + places the partner added.
  const catalog = useMemo(() => mergePlaces(food.restaurants, sharing.states.flatMap(row => Object.values(row.payload.places || {}))), [food.restaurants, sharing.states]);
  const ensurePlace = (r: Restaurant) => { if (r.place) food.addPlace(r.place); };
  useEffect(()=>{setRatingId(null);setFilterOpen(false);setEditingName(false);setActiveId(null);setToast('');},[sharing.userId]);
  const appliedCloudName = useRef<string | null>(null);
  useEffect(() => {
    const member = sharing.members.find(m => m.user_id === sharing.userId);
    if(sharing.accountName&&!member){setProfileName(sharing.accountName);appliedCloudName.current=null;}
    if (member && appliedCloudName.current !== member.user_id) {
      appliedCloudName.current = member.user_id; setProfileName(member.display_name);
      localStorage.setItem('beli-study-profile-name', member.display_name);
    }
  }, [sharing.members, sharing.userId, sharing.accountName]);

  useEffect(() => {
    const onHash = () => { setRoute(initialRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (ratingId) setRatingId(null);
      else if (filterOpen) setFilterOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [ratingId, filterOpen]);

  const cuisines = useMemo(() => [...new Set(catalog.flatMap(r => r.cuisineTags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [catalog]);
  const statusCount = useMemo(() => ({
    been: catalog.filter(r => food.getStatus(r.id) === 'been').length,
    want: catalog.filter(r => food.getStatus(r.id) === 'want').length,
  }), [food, catalog]);
  const sortedFiltered = useMemo(() => {
    const q = listQuery.trim().toLocaleLowerCase();
    const preferredCuisines = new Set(food.ranked.filter(row => row.sentiment === 'liked').flatMap(row => row.restaurant.cuisineTags));
    let data = catalog.filter(r => {
      const status = food.getStatus(r.id);
      const inTab = listTab === 'been' ? status === 'been'
        : listTab === 'want' ? status === 'want'
          : listTab === 'recs' ? !r.closed && status !== 'been' && r.cuisineTags.some(tag => preferredCuisines.has(tag))
            : !r.closed;
      return inTab && (city === 'all' || r.regionSlug === city)
        && (cuisine === 'all' || r.cuisineTags.includes(cuisine))
        && (priceCap === null || (r.avgPrice !== null && r.avgPrice <= priceCap))
        && (!photoOnly || !!r.coverUrl)
        && (!q || `${r.searchText} ${r.reviewText.toLocaleLowerCase()}`.includes(q));
    });
    data = [...data].sort((a, b) => {
      if (sortMode === 'name') return a.displayName.localeCompare(b.displayName, 'zh-CN');
      if (sortMode === 'score') return (food.getScore(b.id) ?? -1) - (food.getScore(a.id) ?? -1) || a.displayName.localeCompare(b.displayName, 'zh-CN');
      return (b.visitedAt || '').localeCompare(a.visitedAt || '') || a.displayName.localeCompare(b.displayName, 'zh-CN');
    });
    return data;
  }, [food, catalog, listTab, city, cuisine, priceCap, photoOnly, listQuery, sortMode]);

  useEffect(() => {
    if (activeId && !sortedFiltered.some(r => r.id === activeId)) setActiveId(null);
  }, [activeId, sortedFiltered]);

  const openRating = (r: Restaurant, mode: 'visit' | 'rerank' = 'visit') => { ensurePlace(r); setRatingMode(mode); setRatingId(r.id); };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setToast('页面链接已复制'); }
    catch { setToast('无法复制链接'); }
  };

  const detail = route.id ? catalog.find(r => r.id === route.id) : null;
  const page = route.page === 'detail' && !detail ? 'feed' : route.page;

  if(!sharing.authReady)return <SessionScreen message="正在恢复登录状态…"/>;
  if(!sharing.userId)return <LoginScreen sharing={sharing} onSuccess={()=>navTo('feed')}/>;
  if(!sharing.accountName)return <SessionScreen message="" error="当前账号无法访问" onSignOut={()=>void sharing.signOut()}/>;
  if(sharing.loading||sharing.loadedUserId!==sharing.userId)return <SessionScreen message="正在载入你的记录…" error={sharing.error} onRetry={()=>void sharing.reloadCloud()} onSignOut={()=>void sharing.signOut()}/>;
  const displayName=sharing.members.find(member=>member.user_id===sharing.userId)?.display_name||sharing.accountName;
  if(!sharing.space)return <main className="login-screen"><div className="login-content"><span className="brand">beli</span><SharingPanel catalog={catalog} sharing={sharing} name={displayName} onOpen={()=>{}}/></div></main>;

  return <div className="app-shell">
    <aside className="desktop-rail">
      <div className="rail-logo">beli</div>
      <BottomNav page={page} />
      <p>Your favorite restaurants, ranked.</p>
    </aside>
    <main className={`app-main page-${page}`}>
      {page === 'feed' && <FeedPage catalog={catalog} sharing={sharing} food={food} getStatus={food.getStatus} onOpen={r => navTo('detail', r.id)} onSearch={() => navTo('search')} onList={() => navTo('lists')} onToast={setToast} />}
      {page === 'lists' && <>
        <TopBar title={<span className="eyebrow">MY LISTS</span>} right={<><button className="icon-button" onClick={share} aria-label="分享列表"><Share2 size={19} /></button><button className="icon-button" onClick={() => setFilterOpen(true)} aria-label="更多筛选"><Menu size={21} /></button></>} />
        <div className="lists-heading"><button className="heading-dropdown" onClick={() => setFilterOpen(true)}>Restaurants <ChevronDown size={18} /></button><span className="list-count">{sortedFiltered.length} 家</span></div>
        <div className="list-tabs" role="tablist" aria-label="餐厅列表分类">
          {([['been', 'Been'], ['want', 'Want to Try'], ['recs', 'Recs'], ['guides', 'Guides']] as const).map(([key, label]) => <button role="tab" aria-selected={listTab === key} className={listTab === key ? 'selected' : ''} key={key} onClick={() => { setListTab(key); setActiveId(null); }}>{label}</button>)}
          <button className="more-tab" onClick={() => setFilterOpen(true)}>More <ChevronDown size={12} /></button>
        </div>
        <div className="filter-chips">
          <button className="round-chip" onClick={() => setFilterOpen(true)} aria-label="全部筛选"><SlidersHorizontal size={16} /></button>
          <button onClick={() => setFilterOpen(true)}>{city === 'all' ? 'City' : regionName(city)} <ChevronDown size={13} /></button>
          <button onClick={() => setFilterOpen(true)}>{cuisine === 'all' ? 'Cuisine' : cuisine} <ChevronDown size={13} /></button>
          <button onClick={() => setFilterOpen(true)}>{priceCap === null ? '价格' : `≤ ¥${priceCap}`} <ChevronDown size={13} /></button>
          <button className={photoOnly ? 'chip-active' : ''} onClick={() => setPhotoOnly(v => !v)}>有照片</button>
          {listQuery && <button className="chip-active" onClick={() => setListQuery('')}>“{listQuery}” <X size={12} /></button>}
        </div>
        <div className="list-toolbar"><div className="segment" role="group" aria-label="视图切换"><button className={listView === 'list' ? 'on' : ''} onClick={() => setListView('list')}><List size={16} /> List</button><button className={listView === 'map' ? 'on' : ''} onClick={() => setListView('map')}><MapIcon size={16} /> Map</button></div><button className="sort-button" onClick={() => setFilterOpen(true)}>排序 <Filter size={14} /></button></div>
        {listTab === 'recs' && <p className="source-note">根据你喜欢的菜系，发现下一家想去的餐厅。</p>}
        {listTab === 'guides' && <p className="source-note">按城市与菜系探索餐厅。</p>}
        <div className={`list-content ${listView === 'map' ? 'map-mode' : ''}`}>
          {listView === 'map' ? <>
            <Suspense fallback={<div className="map-loading">正在载入地图…</div>}><MapPane restaurants={sortedFiltered} activeId={activeId} onSelect={setActiveId} getScore={food.getScore} citySlug={city === 'all' ? null : city} /></Suspense>
            {activeId && catalog.find(r => r.id === activeId) && <div className="map-preview"><RestaurantRow r={catalog.find(r => r.id === activeId)!} status={food.getStatus(activeId)} score={food.getScore(activeId)} onOpen={() => navTo('detail', activeId)} onStatus={() => food.setStatus(activeId, food.getStatus(activeId) === 'been' ? 'want' : 'been')} compact /></div>}
            {sortedFiltered.length === 0 && <EmptyList onReset={() => { setCity('all'); setCuisine('all'); setPriceCap(null); setPhotoOnly(false); setListQuery(''); }} />}
          </> : sortedFiltered.length ? <div className="restaurant-list">{sortedFiltered.map(r => <RestaurantRow key={r.id} r={r} status={food.getStatus(r.id)} score={food.getScore(r.id)} onOp…12143 tokens truncated…    .on('postgres_changes',{event:'*',schema:'public',table:'beli_members',filter:`space_id=eq.${space.id}`},update)
        .subscribe(state=>{if(!cancelled&&state==='SUBSCRIBED')update();if(!cancelled)setRealtimeStatus(state==='SUBSCRIBED'?'':state==='CHANNEL_ERROR'||state==='TIMED_OUT'?'实时连接中断，定期刷新':'正在连接实时更新');});
    })().catch(()=>{if(!cancelled)setRealtimeStatus('实时连接中断，定期刷新');});
    const poll=window.setInterval(update,30000);window.addEventListener('focus',update);
    return()=>{cancelled=true;clearInterval(poll);window.removeEventListener('focus',update);if(channel)void client?.removeChannel(channel);};
  },[space,refresh]);
  useEffect(()=>{
    if(!client||!space||!userId||!ready)return;
    const epoch=identityEpoch.current;const payload=food.snapshot;const json=JSON.stringify(payload);if(json===lastSynced.current)return;
    const timer=setTimeout(()=>{queue.current=queue.current.then(async()=>{
      if(!client||epoch!==identityEpoch.current||conflict.current||json===lastSynced.current)return;setStatus('正在同步');setError('');
      try{await uploadNewPhotos(payload,space.id,userId,lastSynced.current);if(epoch!==identityEpoch.current)return;const {data,error}=await client.rpc('beli_save_state',{target_space:space.id,state_payload:payload,expected_revision:revision.current});if(error)throw error;if(epoch!==identityEpoch.current)return;revision.current=Number(data);lastSynced.current=json;setStatus('已同步');await refresh(space.id);}
      catch(err){const message=err instanceof Error?err.message:String((err as {message?:string})?.message||'同步失败');if(message.includes('SYNC_CONFLICT')){conflict.current=true;setReady(false);setError('另一台设备已有更新，请先载入云端记录。');}else setError(message);setStatus('同步未完成');}
    });},700);return()=>clearTimeout(timer);
  },[food.snapshot,space,userId,ready,tick,uploadNewPhotos,refresh]);
  const signIn=async(name:IdentityName,password:string)=>{if(!client)throw new Error('暂时无法连接，请稍后重试');setError('');const identity=identities.find(item=>item.name===name);if(!identity)throw new Error('请选择身份');const {error}=await client.auth.signInWithPassword({email:identity.email,password});if(error)throw new Error((error.code==='invalid_credentials'||/invalid login credentials/i.test(error.message))?'密码不正确，请重试':'暂时无法登录，请稍后重试');};
  const changePassword=async(password:string)=>{if(!client)return;const {error}=await client.auth.updateUser({password});if(error)throw error;};
  const updateName=async(name:string)=>{if(!client||!space)return;const {error}=await client.rpc('beli_update_name',{member_name:name});if(error)throw error;await refresh(space.id);};
  const sendLink=async(email:string)=>{if(!client)return;const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+import.meta.env.BASE_URL}});if(error)throw error;setStatus('登录链接已发送，请查收邮件');};
  const create=async(name:string)=>{if(!client||!userId)return;const {data,error}=await client.rpc('beli_create_space',{member_name:name});if(error)throw error;setInvite(data.invite);sessionStorage.setItem('beli-invite',data.invite);await loadSpace(userId);};
  const join=async(token:string,name:string)=>{if(!client||!userId)return;let inviteToken=token.trim();if(inviteToken.includes('#/join/'))inviteToken=inviteToken.split('#/join/')[1].split(/[?&]/)[0];if(!/^[a-f0-9]{32}$/i.test(inviteToken))throw new Error('邀请码格式不正确，请粘贴完整邀请链接或邀请码');const {error}=await client.rpc('beli_join_space',{invite_token:inviteToken,member_name:name});if(error)throw error;sessionStorage.removeItem('beli-invite');setInvite('');await loadSpace(userId);};
  const inviteLink=async()=>{if(!client||!space)return '';const {data,error}=await client.rpc('beli_rotate_invite',{target_space:space.id});if(error)throw error;const link=`${location.origin}${import.meta.env.BASE_URL}#/join/${data}`;await navigator.clipboard.writeText(link);return link;};
  const toggleWant=async(id:string)=>{if(!client||!space||!userId)return;const exists=wants.some(row=>row.restaurant_id===id);const result=exists?await client.from('beli_wants').delete().eq('space_id',space.id).eq('restaurant_id',id):await client.from('beli_wants').insert({space_id:space.id,restaurant_id:id,added_by:userId});if(result.error)throw result.error;await refresh(space.id);};
  const downloadLocalBackup=()=>{if(!userId)return;const saved=localStorage.getItem(`beli-before-cloud-backup:${userId}`);if(!saved)return;const url=URL.createObjectURL(new Blob([saved],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`beli-${accountName||'records'}-backup.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const signOut=async()=>{
    const uid=userId;const wasReady=ready;
    identityEpoch.current++;setReady(false);setLoadedUserId(null);
    try{
      if(uid)localStorage.setItem(`beli-food-cache:${uid}`,JSON.stringify(foodRef.current.snapshot));
      await queue.current;const result=await client?.auth.signOut({scope:'local'});
      if(result?.error)throw result.error;
      restore(emptySnapshot('empty'));localStorage.removeItem('beli-food-owner');
    }catch{setError('退出未完成，请检查网络或本机存储后重试。');setLoadedUserId(uid);setReady(wasReady);}
  };
  return{loadPhoto,configured:!!client,authReady,loadedUserId,userId,accountName,space,members,states,wants,status:realtimeStatus||status,error,invite,ready,loading,hasLocalBackup,downloadLocalBackup,signIn,changePassword,updateName,sendLink,create,join,inviteLink,toggleWant,retry:()=>setTick(v=>v+1),reloadCloud:()=>userId?loadSpace(userId):Promise.resolve(),signOut};
}
export type SharingController=ReturnType<typeof useSharing>;
