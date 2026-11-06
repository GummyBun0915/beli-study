import { dateMatches } from '../state/feedDates';
import { useMemo, useState } from 'react';
import { ChevronRight, CirclePlus } from 'lucide-react';
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
  return <section className="feed-section feed-diary" id="your-feed" aria-label="用餐记录">
    <div className="section-head"><h2>MY FEED</h2><button onClick={onRecord}><CirclePlus size={13} /> 记录一餐</button></div>
    <div className="feed-date-filter" aria-label="按用餐时间筛选">
      <div className="choice-row">{['全部时间','今年','本月'].map(label=><button key={label} aria-pressed={range.label===label&&!custom} className={range.label===label&&!custom?'selected':''} onClick={()=>label==='全部时间'?applyRange('','',label):label==='今年'?applyRange(`${year}-01-01`,`${year}-12-31`,label):applyRange(`${year}-${month}-01`,`${year}-${month}-${new Date(year,now.getMonth()+1,0).getDate()}`,label)}>{label}</button>)}<button aria-expanded={custom} onClick={()=>{setDraft({start:range.start,end:range.end});setCustom(!custom);setDateError('');}}>自定义日期</button></div>
      {custom&&<form className="feed-date-form" onSubmit={e=>{e.preventDefault();if(!draft.start&&!draft.end){setDateError('请选择起始或结束日期');return;}if(draft.start&&draft.end&&draft.start>draft.end){setDateError('结束日期不能早于开始日期');return;}applyRange(draft.start,draft.end,'自定义');}}><label>开始日期<input type="date" value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><span>至</span><label>结束日期<input type="date" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label><button className="primary" type="submit">应用</button><button type="button" onClick={()=>setCustom(false)}>取消</button>{dateError&&<p role="alert">{dateError}</p>}</form>}
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
