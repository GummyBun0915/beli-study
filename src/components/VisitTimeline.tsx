import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import type { PublishedImage } from '../data/restaurants';
import type { VisitEntry } from '../state/useFoodState';
import { sentimentLabel } from '../state/useFoodState';
import { readPhoto } from '../state/photos';
import { PhotoCarousel, PhotoViewer } from './PhotoGallery';

export function LocalPhotos({ ids, label }: { ids: string[]; label: string }) {
  const [images,setImages]=useState<PublishedImage[]>([]);const [open,setOpen]=useState<number|null>(null);
  useEffect(()=>{let alive=true;const urls:string[]=[];Promise.all(ids.map(readPhoto)).then(blobs=>{const photos=blobs.flatMap(blob=>{if(!blob)return[];const url=URL.createObjectURL(blob);urls.push(url);return[{src:url,thumb:url,w:0,h:0,pos:'50% 50%'}];});if(alive)setImages(photos);else urls.forEach(URL.revokeObjectURL);}).catch(()=>{});return()=>{alive=false;urls.forEach(URL.revokeObjectURL);};},[ids]);
  return images.length?<><PhotoCarousel className="feed-gallery" images={images} label={label} onOpen={setOpen}/>{open!==null&&<PhotoViewer images={images} label={label} initialIndex={open} onClose={()=>setOpen(null)}/>}</>:null;
}
export function VisitTimeline({ visits, name }: { visits: VisitEntry[]; name: string }) {
  if(!visits.length)return null;
  return <section className="detail-section visit-timeline"><h2>用餐记录 <span>{visits.length}</span></h2>{[...visits].reverse().map(visit=><article key={visit.id}><div className="visit-date"><UtensilsCrossed size={15}/><strong>{visit.visitedAt||'日期未填写'}</strong><span>{sentimentLabel[visit.sentiment]}</span></div>{visit.branch&&<p className="subtle">{visit.branch}</p>}{visit.notes&&<p>{visit.notes}</p>}{visit.dishes.filter(Boolean).length>0&&<p className="visit-dishes">Favorite dishes: {visit.dishes.filter(Boolean).join('、')}</p>}{visit.tags.filter(Boolean).length>0&&<div className="row-tags">{visit.tags.filter(Boolean).map(tag=><span key={tag}>{tag}</span>)}</div>}<LocalPhotos ids={visit.photoIds} label={`${name} · ${visit.visitedAt||'用餐记录'}`}/></article>)}</section>;
}
