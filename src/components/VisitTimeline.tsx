import { useEffect, useRef, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import type { PublishedImage } from '../data/restaurants';
import type { VisitEntry } from '../state/useFoodState';
import { sentimentLabel } from '../state/useFoodState';
import type { SharingController } from '../state/useSharing';
import { PhotoCarousel, PhotoViewer } from './PhotoGallery';

type LoadPhoto = SharingController['loadPhoto'];

export function LocalPhotos({ ids, label, ownerId, loadPhoto }: {
  ids: string[]; label: string; ownerId: string; loadPhoto: LoadPhoto;
}) {
  const unique = [...new Set(ids)];
  return unique.length ? <VisitPhotos key={JSON.stringify([ownerId, unique])} ids={unique} label={label} ownerId={ownerId} loadPhoto={loadPhoto}/> : null;
}

function VisitPhotos({ ids, label, ownerId, loadPhoto }: {
  ids: string[]; label: string; ownerId: string; loadPhoto: LoadPhoto;
}) {
  const [photos, setPhotos] = useState<Record<string, PublishedImage | 'loading' | 'failed'>>({});
  const [viewer, setViewer] = useState<{ images: PublishedImage[]; index: number } | null>(null);
  const start = useRef<(id: string, retry: boolean) => void>(() => {});
  const [photoIds] = useState(ids);
  useEffect(() => {
    const controller = new AbortController();
    const urls = new Set<string>();
    start.current = (id, retry) => {
      setPhotos(current => ({ ...current, [id]: 'loading' }));
      void (async () => {
        let url: string | undefined;
        try {
          const blob = await loadPhoto(ownerId, id, retry, controller.signal);
          if (controller.signal.aborted) return;
          if (!blob) throw new Error('Photo unavailable');
          url = URL.createObjectURL(blob);
          urls.add(url);
          const image = new Image();
          image.src = url;
          await image.decode();
          if (controller.signal.aborted) return;
          const photo = { src: url, thumb: url, w: image.naturalWidth, h: image.naturalHeight, pos: '50% 50%' };
          setPhotos(current => ({ ...current, [id]: photo }));
        } catch {
          if (url) { URL.revokeObjectURL(url); urls.delete(url); }
          if (!controller.signal.aborted) setPhotos(current => ({ ...current, [id]: 'failed' }));
        }
      })();
    };
    photoIds.forEach(id => start.current(id, false));
    return () => {
      controller.abort();
      urls.forEach(URL.revokeObjectURL);
    };
  }, [photoIds, ownerId, loadPhoto]);

  const images = photoIds.flatMap(id => {
    const photo = photos[id];
    return typeof photo === 'object' ? [photo] : [];
  });
  return <>
    {images.length > 0 && <PhotoCarousel className="feed-gallery" images={images} label={label} onOpen={index => setViewer({ images, index })}/>}
    {photoIds.map((id, index) => typeof photos[id] !== 'object' && <div className="visit-photo-status" key={id}>
      <span role="status">照片 {index + 1}{photos[id] === 'failed' ? '加载失败' : '正在加载…'}</span>
      {photos[id] === 'failed' && <button type="button" onClick={() => start.current(id, true)}>重试照片 {index + 1}</button>}
    </div>)}
    {viewer && <PhotoViewer images={viewer.images} label={label} initialIndex={viewer.index} onClose={() => setViewer(null)}/>}
  </>;
}

export function VisitTimeline({ visits, name, ownerId, loadPhoto }: {
  visits: VisitEntry[]; name: string; ownerId: string; loadPhoto: LoadPhoto;
}) {
  if(!visits.length)return null;
  return <section className="detail-section visit-timeline"><h2>用餐记录 <span>{visits.length}</span></h2>{[...visits].reverse().map(visit=><article key={visit.id}><div className="visit-date"><UtensilsCrossed size={15}/><strong>{visit.visitedAt||'日期未填写'}</strong><span>{sentimentLabel[visit.sentiment]}</span></div>{visit.branch&&<p className="subtle">{visit.branch}</p>}{visit.notes&&<p>{visit.notes}</p>}{visit.dishes.filter(Boolean).length>0&&<p className="visit-dishes">Favorite dishes: {visit.dishes.filter(Boolean).join('、')}</p>}{visit.tags.filter(Boolean).length>0&&<div className="row-tags">{visit.tags.filter(Boolean).map(tag=><span key={tag}>{tag}</span>)}</div>}<LocalPhotos ownerId={ownerId} loadPhoto={loadPhoto} ids={visit.photoIds} label={`${name} · ${visit.visitedAt||'用餐记录'}`}/></article>)}</section>;
}
