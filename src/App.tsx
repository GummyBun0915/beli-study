import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bookmark, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, CirclePlus, Clock3, Compass, Filter,
  Heart, List, Map as MapIcon, MapPin, Menu, Search, Share2,
  SlidersHorizontal, Sparkles, Star, Trophy, UserRound, UtensilsCrossed,
  X,
} from 'lucide-react';
import type { Restaurant } from './data/restaurants';
import { formattedVisitDate, imageUrl, regionName, regions, restaurants } from './data/restaurants';
import { useFoodState, type FoodStatus, type FoodStateController } from './state/useFoodState';
import { useSharing, type SharingController } from './state/useSharing';
import { LoginScreen, SessionScreen } from './components/LoginScreen';
import { SharedFeed } from './components/SharedFeed';
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

  const cuisines = useMemo(() => [...new Set(restaurants.flatMap(r => r.cuisineTags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), []);
  const statusCount = useMemo(() => ({
    been: restaurants.filter(r => food.getStatus(r.id) === 'been').length,
    want: restaurants.filter(r => food.getStatus(r.id) === 'want').length,
  }), [food]);
  const sortedFiltered = useMemo(() => {
    const q = listQuery.trim().toLocaleLowerCase();
    const preferredCuisines = new Set(food.ranked.filter(row => row.sentiment === 'liked').flatMap(row => row.restaurant.cuisineTags));
    let data = restaurants.filter(r => {
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
  }, [food, listTab, city, cuisine, priceCap, photoOnly, listQuery, sortMode]);

  useEffect(() => {
    if (activeId && !sortedFiltered.some(r => r.id === activeId)) setActiveId(null);
  }, [activeId, sortedFiltered]);

  const openRating = (r: Restaurant, mode: 'visit' | 'rerank' = 'visit') => { setRatingMode(mode); setRatingId(r.id); };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setToast('页面链接已复制'); }
    catch { setToast('无法复制链接'); }
  };

  const detail = route.id ? restaurants.find(r => r.id === route.id) : null;
  const page = route.page === 'detail' && !detail ? 'feed' : route.page;

  if(!sharing.authReady)return <SessionScreen message="正在恢复登录状态…"/>;
  if(!sharing.userId)return <LoginScreen sharing={sharing} onSuccess={()=>navTo('feed')}/>;
  if(!sharing.accountName)return <SessionScreen message="" error="当前账号无法访问" onSignOut={()=>void sharing.signOut()}/>;
  if(sharing.loading||sharing.loadedUserId!==sharing.userId)return <SessionScreen message="正在载入你的记录…" error={sharing.error} onRetry={()=>void sharing.reloadCloud()} onSignOut={()=>void sharing.signOut()}/>;
  const displayName=sharing.members.find(member=>member.user_id===sharing.userId)?.display_name||sharing.accountName;
  if(!sharing.space)return <main className="login-screen"><div className="login-content"><span className="brand">beli</span><SharingPanel sharing={sharing} name={displayName} onOpen={()=>{}}/></div></main>;

  return <div className="app-shell">
    <aside className="desktop-rail">
      <div className="rail-logo">beli</div>
      <BottomNav page={page} />
      <p>Your favorite restaurants, ranked.</p>
    </aside>
    <main className={`app-main page-${page}`}>
      {page === 'feed' && <FeedPage sharing={sharing} food={food} getStatus={food.getStatus} onOpen={r => navTo('detail', r.id)} onSearch={() => navTo('search')} onList={() => navTo('lists')} onToast={setToast} />}
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
            {activeId && restaurants.find(r => r.id === activeId) && <div className="map-preview"><RestaurantRow r={restaurants.find(r => r.id === activeId)!} status={food.getStatus(activeId)} score={food.getScore(activeId)} onOpen={() => navTo('detail', activeId)} onStatus={() => food.setStatus(activeId, food.getStatus(activeId) === 'been' ? 'want' : 'been')} compact /></div>}
            {sortedFiltered.length === 0 && <EmptyList onReset={() => { setCity('all'); setCuisine('all'); setPriceCap(null); setPhotoOnly(false); setListQuery(''); }} />}
          </> : sortedFiltered.length ? <div className="restaurant-list">{sortedFiltered.map(r => <RestaurantRow key={r.id} r={r} status={food.getStatus(r.id)} score={food.getScore(r.id)} onOpen={() => navTo('detail', r.id)} onStatus={() => food.setStatus(r.id, food.getStatus(r.id) === 'been' ? 'want' : 'been')} />)}</div> : <EmptyList onReset={() => { setCity('all'); setCuisine('all'); setPriceCap(null); setPhotoOnly(false); setListQuery(''); }} />}
        </div>
      </>}
      {page === 'search' && <SearchPage query={query} onQuery={setQuery} onOpen={r => navTo('detail', r.id)} getStatus={food.getStatus} getScore={food.getScore} onRate={openRating} />}
      {page === 'rank' && <RankPage ranked={food.ranked} totalBeen={statusCount.been} onOpen={r => navTo('detail', r.id)} onExplore={() => navTo('lists')} onCompare={() => { const first = food.ranked[0]; if (first) openRating(first.restaurant, 'rerank'); }} onUndo={food.undoComparison} hasComparisons={food.comparisonHistory.length > 0} />}
      {page === 'profile' && <ProfilePage name={editingName?profileName:displayName} editing={editingName} onEdit={setEditingName} onName={setProfileName} onSave={() => { const value = profileName.trim() || 'WXY'; setProfileName(value); localStorage.setItem('beli-study-profile-name', value); if (sharing.space) void sharing.updateName(value).catch(() => setToast('名字尚未同步，请重试')); setEditingName(false); }} counts={statusCount} rated={food.ranked.length} onTab={tab => { setListTab(tab); navTo('lists'); }} onRank={() => navTo('rank')} onReset={() => { if (window.confirm('清除本机保存的去过/想去、评分和比较记录？')) food.reset(); }} />}
      {page === 'profile' && <SharingPanel sharing={sharing} name={displayName} onOpen={r => navTo('detail', r.id)} />}
      {page === 'detail' && detail && <DetailPage food={food} sharing={sharing} onToast={setToast} r={detail} status={food.getStatus(detail.id)} score={food.getScore(detail.id)} onBack={() => { if (window.history.length > 1) window.history.back(); else navTo('lists'); }} onStatus={status => food.setStatus(detail.id, status)} onRate={() => openRating(detail)} onRerank={() => openRating(detail, 'rerank')} onShare={share} />}
    </main>
    <BottomNav page={page} />
    {filterOpen && <div className="modal-backdrop" onClick={() => setFilterOpen(false)}><div className="filter-sheet" role="dialog" aria-modal="true" aria-label="筛选餐厅" onClick={e => e.stopPropagation()}><div className="sheet-handle" /><button className="sheet-close" onClick={() => setFilterOpen(false)} aria-label="关闭"><X size={21} /></button><h2>筛选餐厅</h2><div className="filter-section"><h3>Selected list</h3><div className="selection-grid"><button className={listTab === 'been' ? 'chosen' : ''} onClick={() => setListTab('been')}><CheckCircle2 size={20} /><strong>Been</strong><small>{statusCount.been} 家</small></button><button className={listTab === 'want' ? 'chosen' : ''} onClick={() => setListTab('want')}><Bookmark size={20} /><strong>Want to Try</strong><small>{statusCount.want} 家</small></button><button className={listTab === 'recs' ? 'chosen' : ''} onClick={() => setListTab('recs')}><Heart size={20} /><strong>Recs</strong><small>为你推荐</small></button><button className={listTab === 'guides' ? 'chosen' : ''} onClick={() => setListTab('guides')}><Star size={20} /><strong>Guides</strong><small>城市指南</small></button></div></div><div className="filter-section"><h3>Sort by</h3><div className="choice-row">{([['recent', '最近'], ['score', '我的评分'], ['name', '名称']] as const).map(([value, label]) => <button key={value} className={sortMode === value ? 'selected' : ''} onClick={() => setSortMode(value)}>{label}</button>)}</div></div><div className="filter-section"><h3>搜索</h3><input className="sheet-search" type="search" value={listQuery} onChange={e => setListQuery(e.target.value)} placeholder="店名、菜系、菜品" /></div><div className="filter-section"><h3>City</h3><select value={city} onChange={e => setCity(e.target.value)}><option value="all">全部地区</option>{regions.map(r => <option key={r.slug} value={r.slug}>{r.name} · {r.count + r.wait}</option>)}</select></div><div className="filter-section"><h3>Cuisine</h3><select value={cuisine} onChange={e => setCuisine(e.target.value)}><option value="all">全部菜系</option>{cuisines.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="filter-section"><h3>Price · 人均</h3><div className="choice-row">{([null, 80, 150, 300] as const).map(value => <button key={value ?? 'all'} className={priceCap === value ? 'selected' : ''} onClick={() => setPriceCap(value)}>{value ? `≤ ¥${value}` : '不限'}</button>)}</div><p className="subtle">仅显示已填写人均价格的餐厅。</p></div><label className="check-row"><input type="checkbox" checked={photoOnly} onChange={e => setPhotoOnly(e.target.checked)} />只看有实拍的餐厅</label><div className="sheet-actions"><button onClick={() => { setCity('all'); setCuisine('all'); setPriceCap(null); setPhotoOnly(false); setSortMode('recent'); setListQuery(''); }}>Clear all</button><button className="primary" onClick={() => setFilterOpen(false)}>查看 {sortedFiltered.length} 家</button></div></div></div>}
    {ratingId && <RankingFlow restaurant={restaurants.find(r => r.id === ratingId)!} food={food} mode={ratingMode} onClose={() => setRatingId(null)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function RestaurantRow({ r, status, score, onOpen, onStatus, compact = false }: { r: Restaurant; status: FoodStatus; score: number | null; onOpen: () => void; onStatus: () => void; compact?: boolean }) {
  return <article className={`restaurant-row ${compact ? 'compact' : ''} ${r.closed ? 'closed' : ''}`}>
    <button className="row-main" onClick={onOpen} aria-label={`查看 ${r.displayName} 详情`}>
      {compact && img(r, 'row-photo')}
      <span className="row-text"><strong>{r.displayName}</strong><InfoLine r={r} /><span className="row-tags">{r.closed && <span>已停业</span>}{r.mapPoint === null && <span>暂无坐标</span>}</span>{!compact && r.reviewText && <span className="row-review">{r.reviewText}</span>}</span>
      <span className="row-trailing">{score !== null ? <b className="score-badge">{score.toFixed(1)}</b> : <ChevronRight size={18} strokeWidth={1.5} />}</span>
    </button>
    {!compact && <div className="row-actions"><span>{formattedVisitDate(r) || (status === 'want' ? '想去' : '日期未记录')}</span><button onClick={onStatus} aria-label={status === 'been' ? `把 ${r.displayName} 移到想去` : `把 ${r.displayName} 标记为去过`}>{status === 'been' ? <CheckCircle2 size={18} /> : <Bookmark size={18} />}{status === 'been' ? '去过' : '想去'}</button></div>}
  </article>;
}

function EmptyList({ onReset }: { onReset: () => void }) { return <div className="empty-state"><Search size={28} /><h3>这里暂时没有餐厅</h3><p>换个地区或清除筛选看看。</p><button onClick={onReset}>清除筛选</button></div>; }

function FeedPage({ sharing, food, getStatus, onOpen, onSearch, onList, onToast }: { sharing: SharingController; food: FoodStateController; getStatus: (id: string) => FoodStatus; onOpen: (r: Restaurant) => void; onSearch: () => void; onList: () => void; onToast: (s: string) => void }) {
  const visited = [...restaurants].filter(r => getStatus(r.id) === 'been' && !r.closed).sort((a, b) => (b.visitedAt || '').localeCompare(a.visitedAt || ''));
  const wanted = restaurants.filter(r => getStatus(r.id) === 'want');
  const featured = [
    { label: '最近吃过', sub: `${visited.filter(r => r.inRecent).length} 家餐厅`, data: visited.filter(r => r.inRecent), color: 'featured-one' },
    { label: '城市探索', sub: `${regions.filter(r => r.count + r.wait > 0).length} 个目的地`, data: restaurants.filter(r => !r.closed), color: 'featured-two' },
    { label: '想去清单', sub: `${wanted.length} 家收藏`, data: wanted, color: 'featured-three' },
  ];
  return <>
    <header className="feed-header"><div className="brand">beli</div><div className="header-icons"><button aria-label="最近记录" onClick={() => document.getElementById('your-feed')?.scrollIntoView({ behavior: 'smooth' })}><CalendarDays size={19} /></button><button aria-label="通知" onClick={() => onToast('目前没有社交通知')}><Sparkles size={19} /></button><button aria-label="打开列表" onClick={onList}><Menu size={21} /></button></div></header>
    <button className="search-field fake-input" onClick={onSearch}><Search size={18} /><span>Search restaurant, cuisine, occasion</span></button>
    <div className="feed-pills"><button onClick={onList}><Compass size={15} /> 探索列表</button><button onClick={() => document.getElementById('your-feed')?.scrollIntoView({ behavior: 'smooth' })}><Clock3 size={15} /> 最近记录</button><button onClick={onList}><Bookmark size={15} /> 想去</button></div>
    <section className="feed-section"><div className="section-head"><h2>FEATURED LISTS</h2><button onClick={onList}>See all <ChevronRight size={13} /></button></div><div className="featured-scroll">{featured.map(f => { const first = f.data.find(r => r.coverUrl); return <button className={`featured-card ${f.color}`} key={f.label} onClick={onList}>{first?.coverUrl && <img src={first.coverUrl} alt="" loading="lazy" />}<div className="featured-shade" /><strong>{f.label}</strong><span>{f.sub}</span></button>; })}</div></section>
    <SharedFeed food={food} sharing={sharing} onOpen={onOpen}/>
  </>;
}

function SearchPage({ query, onQuery, onOpen, getStatus, getScore, onRate }: { query: string; onQuery: (q: string) => void; onOpen: (r: Restaurant) => void; getStatus: (id: string) => FoodStatus; getScore: (id: string) => number | null; onRate: (r: Restaurant) => void }) {
  const [searchCity, setSearchCity] = useState('all');
  const matches = useMemo(() => restaurants.filter(r => (searchCity === 'all' || r.regionSlug === searchCity) && (!query.trim() || `${r.searchText} ${r.reviewText.toLocaleLowerCase()}`.includes(query.trim().toLocaleLowerCase()))).sort((a, b) => (a.closed === b.closed ? 0 : a.closed ? 1 : -1) || a.displayName.localeCompare(b.displayName, 'zh-CN')), [query, searchCity]);
  return <><TopBar title={<span className="eyebrow">SEARCH</span>} /><div className="search-page-head"><h1>Find Dining.</h1><p>寻找下一顿喜欢的味道。</p></div><label className="search-field"><Search size={20} /><input autoFocus type="search" placeholder="店名、菜系、菜品、地区" value={query} onChange={e => onQuery(e.target.value)} />{query && <button onClick={() => onQuery('')} aria-label="清除搜索"><X size={16} /></button>}</label><div className="city-scroll"><button className={searchCity === 'all' ? 'active' : ''} onClick={() => setSearchCity('all')}>全部</button>{regions.map(r => <button className={searchCity === r.slug ? 'active' : ''} key={r.slug} onClick={() => setSearchCity(r.slug)}>{r.name}</button>)}</div><div className="search-results-title"><strong>{matches.length} 家餐厅</strong></div>{matches.length ? <div className="restaurant-list">{matches.map(r => <article key={r.id} className="restaurant-row search-row"><button className="row-main" onClick={() => onOpen(r)}><span className="row-text"><strong>{r.displayName}</strong><InfoLine r={r} /><span className="row-tags"><span>{getStatus(r.id) === 'been' ? '去过' : getStatus(r.id) === 'want' ? '想去' : '未记录'}</span>{r.closed && <span>已停业</span>}</span></span>{getScore(r.id) !== null ? <b className="score-badge">{getScore(r.id)!.toFixed(1)}</b> : <ChevronRight size={18} />}</button><div className="row-actions"><span>{formattedVisitDate(r) || "日期未记录"}</span><button onClick={() => onRate(r)}>打分 <ArrowRight size={15} /></button></div></article>)}</div> : <div className="empty-state"><Search size={28} /><h3>没有找到匹配餐厅</h3><p>试试其他店名或菜系。</p></div>}</>;
}

function RankPage({ ranked, totalBeen, onOpen, onExplore, onCompare, onUndo, hasComparisons }: { ranked: ReturnType<typeof useFoodState>['ranked']; totalBeen: number; onOpen: (r: Restaurant) => void; onExplore: () => void; onCompare: () => void; onUndo: () => void; hasComparisons: boolean }) {
  return <><TopBar title={<span className="eyebrow">LEADERBOARD</span>} /><div className="rank-hero"><Trophy size={27} strokeWidth={1.6} /><span className="eyebrow">YOUR PERSONAL LIST</span><h1>每一口，都有排名。</h1><p>根据你的感受和餐厅偏好比较，形成个人排序。</p><div className="rank-stats"><div><strong>{ranked.length}</strong><span>已排名</span></div><div><strong>{totalBeen - ranked.length}</strong><span>待评</span></div></div></div><div className="rank-tools"><button onClick={onExplore}>去餐厅列表 <ArrowRight size={16} /></button>{ranked.length >= 2 && <button onClick={onCompare}>再比较一次</button>}{hasComparisons && <button onClick={onUndo}>撤销上次排名</button>}</div>{ranked.length ? <div className="rank-list">{ranked.map((item, i) => <button key={item.restaurant.id} onClick={() => onOpen(item.restaurant)} className="rank-item"><span className="rank-pos">{String(i + 1).padStart(2, '0')}</span>{img(item.restaurant, 'rank-photo')}<span className="rank-detail"><strong>{item.restaurant.displayName}</strong><small><InfoLine r={item.restaurant} /></small><span>{item.sentiment === 'liked' ? 'I liked it!' : item.sentiment === 'fine' ? 'It was fine' : 'I didn’t like it'}</span></span><span className="rank-score">{item.score !== null ? item.score.toFixed(1) : '—'}</span></button>)}</div> : <div className="empty-state"><Trophy size={30} /><h3>你的榜单还没有排序</h3><p>打开去过的餐厅，选择感受并比较，榜单就会出现。</p><button onClick={onExplore}>挑一家餐厅</button></div>}</>;
}

function ProfilePage({ name, editing, onEdit, onName, onSave, counts, rated, onTab, onRank, onReset }: { name: string; editing: boolean; onEdit: (v: boolean) => void; onName: (v: string) => void; onSave: () => void; counts: { been: number; want: number }; rated: number; onTab: (tab: ListTab) => void; onRank: () => void; onReset: () => void }) {
  return <><TopBar left={<button className="icon-button" onClick={() => navTo('feed')} aria-label="返回"><ArrowLeft size={20} /></button>} title={<span className="eyebrow">PROFILE</span>} right={<button className="icon-button" onClick={onReset} aria-label="清除本机记录"><Menu size={20} /></button>} /><div className="profile-main"><div className="profile-avatar" aria-label={`${name.charAt(0).toUpperCase()}，蓝底头像`}>{name.charAt(0).toUpperCase()}</div>{editing ? <div className="edit-name"><input value={name} onChange={e => onName(e.target.value)} maxLength={28} aria-label="档案名称" /><button onClick={onSave}>保存</button></div> : <button className="profile-name" onClick={() => onEdit(true)}>{name} <ChevronRight size={16} /></button>}<p>@{name.toLowerCase()}</p><div className="profile-pill">Your dining journal</div><div className="profile-metrics"><div><strong>{counts.been}</strong><span>Been</span></div><div><strong>{counts.want}</strong><span>Want to Try</span></div><div><strong>{rated}</strong><span>Ranked</span></div></div></div><div className="profile-links"><button onClick={() => onTab('been')}><CheckCircle2 size={21} /><strong>Been</strong><span>{counts.been}</span><ChevronRight size={18} /></button><button onClick={() => onTab('want')}><Bookmark size={21} /><strong>Want to Try</strong><span>{counts.want}</span><ChevronRight size={18} /></button><button onClick={() => onTab('recs')}><Heart size={21} /><strong>为你推荐</strong><ChevronRight size={18} /></button><button onClick={onRank}><Trophy size={21} /><strong>个人榜单</strong><span>{rated}</span><ChevronRight size={18} /></button></div></>;
}

function DetailPage({ r, status, score, onBack, onStatus, onRate, onRerank, onShare, food, sharing, onToast }: { r: Restaurant; status: FoodStatus; score: number | null; onBack: () => void; onStatus: (status: FoodStatus) => void; onRate: () => void; onRerank: () => void; onShare: () => void; food: FoodStateController; sharing: SharingController; onToast: (message: string) => void }) {
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  return <><TopBar left={<button className="icon-button" onClick={onBack} aria-label="返回"><ArrowLeft size={22} /></button>} title={<span className="eyebrow">RESTAURANT</span>} right={<button className="icon-button" onClick={onShare} aria-label="分享"><Share2 size={19} /></button>} />{r.images.length > 0 ? <PhotoCarousel className="detail-carousel" images={r.images} label={r.displayName} onOpen={setPhotoIndex} /> : <div className="detail-hero">{img(r)}</div>}<div className="detail-content"><div className="detail-title-row"><div><span className="eyebrow">{regionName(r.regionSlug)}</span><h1>{r.displayName}</h1><InfoLine r={r} /></div>{score !== null && <b className="detail-score">{score.toFixed(1)}</b>}</div>{r.closed && <div className="closed-note">这家餐厅已停业，仍可查看你的用餐记录。</div>}<div className="detail-actions"><button className={status === 'been' ? 'active' : ''} onClick={() => onStatus('been')}><CheckCircle2 size={19} /> 去过</button><button className={status === 'want' ? 'active' : ''} onClick={() => onStatus('want')}><Bookmark size={19} /> 想去</button><button className="rate-action" onClick={onRate}><Star size={19} /> {status === 'been' ? '再去了一次' : '记录用餐'}</button></div>{score !== null && <button className="text-button rerank-button" onClick={onRerank}>重新排名</button>}{sharing.space && <button className={`sharing-outline shared-want-button ${sharing.wants.some(w => w.restaurant_id === r.id) ? 'saved' : ''}`} onClick={() => { void sharing.toggleWant(r.id).catch(() => onToast('操作未完成，请重试')); }}><Bookmark size={16}/>{sharing.wants.some(w => w.restaurant_id === r.id) ? '已加入一起想去' : '一起想去'}</button>}<div className="detail-facts"><div><span>城市</span><strong>{r.actualCity || regionName(r.regionSlug)}</strong></div><div><span>记录日期</span><strong>{formattedVisitDate(r) || '未记录'}</strong></div><div><span>人均</span><strong>{r.avgPrice ? `¥${Math.round(r.avgPrice)}` : '未记录'}</strong></div></div><VisitTimeline visits={food.snapshot.visits[r.id] || []} name={r.displayName}/>{r.reviewText && <section className="detail-section"><h2>Notes</h2><p>{r.reviewText}</p></section>}{r.dishes.length > 0 && <section className="detail-section"><h2>Favorite Dishes</h2><div className="dish-list">{r.dishes.map((d, i) => <div key={`${d.name}-${i}`}><UtensilsCrossed size={17} /><span>{d.name}{d.review ? <small>{d.review}</small> : null}</span></div>)}</div></section>}{r.images.length > 1 && <section className="detail-section"><h2>Photos</h2><div className="detail-gallery">{r.images.map((image, i) => <button key={image.src} onClick={() => setPhotoIndex(i)}><img src={imageUrl(image.thumb)} alt={`${r.displayName} 实拍 ${i + 1}`} loading="lazy" /></button>)}</div></section>}<section className="detail-section"><h2>Location</h2>{r.address ? <p>{r.address}</p> : <p className="subtle">详细地址待补充。</p>}{r.mapPoint ? <p className="subtle"><MapPin size={15} /> 可在地图查看位置</p> : <p className="subtle"><MapPin size={15} /> 位置待补充，可以使用店名搜索导航。</p>}<a className="external-map" href={r.navigationUrl} target="_blank" rel="noopener noreferrer">在{r.navigationProvider}中查找 <ArrowRight size={17} /></a></section>{r.branches.length > 0 && <section className="detail-section"><h2>其他分店</h2><p className="subtle">分店的用餐记录和评分单独保存。</p>{r.branches.map(b => <div className="branch-row" key={b.id}><strong>{b.name}</strong><small>{b.address || '地址未记录'}</small></div>)}</section>}<p className="detail-credit">更新于 {r.contentUpdatedAt}</p></div>{photoIndex !== null && <PhotoViewer images={r.images} label={r.displayName} initialIndex={photoIndex} onClose={() => setPhotoIndex(null)} />}</>;
}

export default App;
