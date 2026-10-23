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
  const posts = useMemo(() => sharedFeed(sharing.members, sharing.states, sharing.userId, food.snapshot, catalog), [sharing.members, sharing.states, sharing.userId, food.snapshot, catalog]);
  return <section className="feed-section feed-diary" id="your-feed" aria-label="两人的用餐动态">
    <div className="section-head"><h2>OUR FEED</h2><button onClick={onRecord}><CirclePlus size={13} /> 记录一餐</button></div>
    {!posts.length && <div className="feed-empty"><p>还没有用餐记录。</p><button onClick={onRecord}>搜索餐厅，记录这一餐</button></div>}
    {posts.slice(0, limit).map(post => {
      const { author, restaurant: r, visit } = post;
      const entry=visit||post.log;
      const notes = post.kind==='history' ? r.reviewText : entry?.notes || '';
      const dishes = post.kind==='history' ? r.dishes.map(dish => dish.name) : entry?.dishes.filter(Boolean) || [];
      return <article className="feed-post" key={post.id} data-author={author.display_name} data-kind={post.kind} data-restaurant={r.id}>
        <button className="post-head" onClick={() => onOpen(r)}><span className="mini-avatar" style={{ background: author.avatar_color }}>{author.avatar_letter}</span><span><strong>{author.display_name} {post.kind==='status'?'标记去过':'记录了'} {r.brand}</strong><small>{entry?.branch || r.actualCity}{r.cuisineTags.length ? ` · ${r.cuisineTags.slice(0, 3).join(' · ')}` : ''}</small></span><ChevronRight size={17}/></button>
        {post.kind!=='history' ? entry && <LocalPhotos ids={entry.photoIds} label={`${author.display_name} · ${r.displayName}`}/> : r.images.length > 0 && <PhotoCarousel className="feed-gallery" images={r.images} label={`${author.display_name} · ${r.displayName}`} onOpen={index => setGallery({ restaurant: r, index })}/>}
        {notes && <p className="post-review"><strong>Notes:</strong> {notes}</p>}
        {dishes.length > 0 && <p className="post-dishes"><strong>Favorite Dishes:</strong> {dishes.join('、')}</p>}
        <div className="post-footer"><span>{post.kind==='history' ? formattedVisitDate(r) || '到访日期未记录' : entry?.visitedAt || '到访日期未填写'}</span>{post.score !== null && <span className="feed-author-score">{author.display_name} 当前评分 <b>{post.score.toFixed(1)}</b></span>}</div>
      </article>;
    })}
    {posts.length > limit && <button className="feed-more" onClick={() => setLimit(value => value + 24)}>查看更多记录 <ChevronRight size={15}/></button>}
    {gallery && <PhotoViewer images={gallery.restaurant.images} label={gallery.restaurant.displayName} initialIndex={gallery.index} onClose={() => setGallery(null)}/>}
  </section>;
}
