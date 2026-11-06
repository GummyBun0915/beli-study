import { dateMatches } from '../state/feedDates';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CirclePlus, X } from 'lucide-react';
import { formattedVisitDate, type Restaurant } from '../data/restaurants';
import type { FoodStateController } from '../state/useFoodState';
import type { SharingController } from '../state/useSharing';
import { sharedFeed } from '../state/sharedFeed';
import { LocalPhotos } from './VisitTimeline';
import { PhotoCarousel, PhotoViewer } from './PhotoGallery';

export function SharedFeed({ catalog, food, sharing, onOpen, onRecord }: { catalog: Restaurant[]; food: FoodStateController; sharing: SharingController; onOpen: (restaurant: Restaurant) => void; onRecord: () => void }) {
  const [limit, setLimit] = useState(24);
  const [gallery, setGallery] = useState<{ restaurant: Restaurant; index: number } | null>(null);
  const allPosts = useMemo(() => sharedFeed(sharing.members, sharing.states, sharing.userId, food.snapshot, catalog), [sharing.members, sharing.states, sharing.userId, food.snapshot, catalog]);
  const [range,setRange]=useState({start:'',end:'',label:'全部时间'});
  const [custom,setCustom]=useState(false);
  const [draft,setDraft]=useState({start:'',end:''});
  const [dateError,setDateError]=useState('');
  const posts=allPosts.filter(post=>dateMatches(post.kind==='history' ? post.log?.visitedAt || post.restaurant.visitedAt || '' : post.visit?.visitedAt || post.log?.visitedAt || '',range.start,range.end));
  const applyRange=(start:string,end:string,label:string)=>{setRange({start,end,label});setLimit(24);setCustom(false);setDateError('');};
  const now=new Date();const year=now.getFullYear();const month=String(now.getMonth()+1).padStart(2,'0');
  const undated=allPosts.filter(post=>!(post.kind==='history'?(post.log?.visitedAt||post.restaurant.visitedAt):post.visit?.visitedAt||post.log?.visitedAt)).length;
  const openCustom=()=>{setDraft({start:range.start,end:range.end});setCustom(true);setDateError('');};
  const closeCustom=()=>{setCustom(false);setDateError('');};
  useEffect(()=>{
    if(!custom)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')closeCustom();};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[custom]);
  const presets:[string,()=>void][]=[
    ['全部时间',()=>applyRange('','','全部时间')],
    ['今年',()=>applyRange(`${year}-01-01`,`${year}-12-31`,'今年')],
    ['本月',()=>applyRange(`${year}-${month}-01`,`${year}-${month}-${new Date(year,now.getMonth()+1,0).getDate()}`,'本月')],
  ];
  return <section className="feed-section feed-diary" id="your-feed" aria-label="用餐记录">
    <div className="section-head"><h2>MY FEED</h2><button onClick={onRecord}><CirclePlus size={13} /> 记录一餐</button></div>
    <div className="feed-date-filter" aria-label="按用餐时间筛选">
      <div className="filter-chips">
        {presets.map(([label,apply])=><button key={label} type="button" aria-pressed={range.label===label} className={range.label===label?'chip-active':''} onClick={apply}>{label}</button>)}
        <button type="button" aria-expanded={custom} aria-haspopup="dialog" className={range.label==='自定义'?'chip-active':''} onClick={openCustom}>自定义日期 <ChevronDown size={13} /></button>
      </div>
      {custom&&<div className="modal-backdrop" onClick={closeCustom}><form className="filter-sheet feed-date-sheet" role="dialog" aria-modal="true" aria-label="自定义日期" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();if(!draft.start&&!draft.end){setDateError('请选择起始或结束日期');return;}if(draft.start&&draft.end&&draft.start>draft.end){setDateError('结束日期不能早于开始日期');return;}applyRange(draft.start,draft.end,'自定义');}}><div className="sheet-handle" /><button className="sheet-close" type="button" onClick={closeCustom} aria-label="关闭"><X size={21} /></button><h2>自定义日期</h2><div className="filter-section feed-date-fields"><label>开始日期<input type="date" value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><label>结束日期<input type="date" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label>{dateError&&<p role="alert">{dateError}</p>}</div><div className="sheet-actions"><button type="button" onClick={closeCustom}>取消</button><button className="primary" type="submit">应用</button></div></form></div>}
      <div className="feed-date-summary" role="status">{range.label==='自定义'?`${range.start||'最早'} 至 ${range.end||'最近'}`:range.label} · {posts.length} 条记录{(range.start||range.end)&&<button onClick={()=>applyRange('','','全部时间')}>清除筛选</button>}</div>
      {Boolean((range.start||range.end)&&undated)&&<p className="subtle">另有 {undated} 条未填写日期的记录，可在“全部时间”中查看。仅记录月份的用餐按月份筛选。</p>}
    </div>
    {!posts.length && <div className="feed-empty"><p>{range.start||range.end?'这段时间没有用餐记录。试试其他日期，或清除筛选。':'还没有用餐记录。'}</p><button onClick={onRecord}>搜索餐厅，记录这一餐</button></div>}
    {posts.slice(0, limit).map(post => {
      const { author, restaurant: r, visit } = post;
      const entry=visit||post.log;
      const notes = post.kind==='history' ? entry?.notes ?? r.reviewText : entry?.notes || '';
      const dishes = post.kind==='history' ? entry?.dishes ?? r.dishes.map(dish => dish.name) : entry?.dishes.filter(Boolean) || [];
      return <article className="feed-post" key={post.id} data-author={author.display_name} data-kind={post.kind} data-restaurant={r.id}>
        <button className="post-head" onClick={() => onOpen(r)}><span className="mini-avatar" style={{ background: author.avatar_color }}>{author.avatar_letter}</span><span><strong>{author.display_name} {post.kind==='status'?'标记去过':'记录了'} {r.brand}</strong><small>{entry?.branch || r.actualCity}{r.cuisineTags.length ? ` · ${r.cuisineTags.slice(0, 3).join(' · ')}` : ''}</small></span><ChevronRight size={17}/></button>
        {post.kind!=='history' ? entry && <LocalPhotos ownerId={author.user_id} loadPhoto={sharing.loadPhoto} ids={entry.photoIds} label={`${author.display_name} · ${r.displayName}`}/> : r.images.length > 0 && <PhotoCarousel className="feed-gallery" images={r.images} label={`${author.display_name} · ${r.displayName}`} onOpen={index => setGallery({ restaurant: r, index })}/>}
        {notes && <p className="post-review"><strong>Notes:</strong> {notes}</p>}
        {dishes.length > 0 && <p className="post-dishes"><strong>Favorite Dishes:</strong> {dishes.join('、')}</p>}
        <div className="post-footer"><span>{post.kind==='history' ? entry?.visitedAt || formattedVisitDate(r) || '到访日期未记录' : entry?.visitedAt || '到访日期未填写'}</span>{post.score !== null && <span className="feed-author-score">{author.display_name} 当前评分 <b>{post.score.toFixed(1)}</b></span>}</div>
      </article>;
    })}
    {posts.length > limit && <button className="feed-more" onClick={() => setLimit(value => value + 24)}>查看更多记录 <ChevronRight size={15}/></button>}
    {gallery && <PhotoViewer images={gallery.restaurant.images} label={gallery.restaurant.displayName} initialIndex={gallery.index} onClose={() => setGallery(null)}/>}
  </section>;
}
