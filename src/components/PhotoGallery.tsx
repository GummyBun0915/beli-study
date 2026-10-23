import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { imageUrl, type PublishedImage } from '../data/restaurants';

interface GalleryProps {
  images: PublishedImage[];
  label: string;
  onOpen: (index: number) => void;
  className?: string;
}

/** Native horizontal scrolling preserves touch momentum and works without gesture emulation. */
export function PhotoCarousel({ images, label, onOpen, className = '' }: GalleryProps) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const moveTo = (next: number) => track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: 'smooth' });
  return <div className={`photo-carousel ${className}`} role="region" aria-label={`${label}，${images.length} 张照片`}>
    <div className="photo-carousel-track" ref={track} onScroll={event => {
      const el = event.currentTarget;
      setIndex(Math.round(el.scrollLeft / el.clientWidth));
    }}>
      {images.map((photo, i) => <button className="photo-slide" key={photo.src} onClick={() => onOpen(i)} aria-label={`放大 ${label} 照片 ${i + 1}/${images.length}`}>
        <img src={imageUrl(photo.src)} alt={`${label} 实拍 ${i + 1}`} loading={i ? 'lazy' : 'eager'} draggable={false} style={{ objectPosition: photo.pos }} />
      </button>)}
    </div>
    {images.length > 1 && <>
      <span className="carousel-count" aria-live="polite">{index + 1} / {images.length}</span>
      <button className="carousel-arrow previous" onClick={() => moveTo(index - 1)} disabled={index === 0} aria-label="上一张照片"><ChevronLeft size={20} /></button>
      <button className="carousel-arrow next" onClick={() => moveTo(index + 1)} disabled={index === images.length - 1} aria-label="下一张照片"><ChevronRight size={20} /></button>
      <div className="carousel-dots" aria-label="选择照片">{images.map((photo, i) => <button key={photo.src} className={i === index ? 'current' : ''} onClick={() => moveTo(i)} aria-label={`查看第 ${i + 1} 张照片`} aria-current={i === index ? 'true' : undefined} />)}</div>
    </>}
  </div>;
}

export function PhotoViewer({ images, label, initialIndex, onClose }: { images: PublishedImage[]; label: string; initialIndex: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const touchX = useRef<number | null>(null);
  const change = (delta: number) => setIndex(current => (current + delta + images.length) % images.length);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog className="photo-viewer" ref={dialog} aria-label={`${label} 照片`} onCancel={onClose} onKeyDown={e => {
    if (e.key === 'ArrowLeft') change(-1);
    if (e.key === 'ArrowRight') change(1);
  }}>
    <button className="viewer-close" onClick={onClose} aria-label="关闭照片"><X size={24} /></button>
    <div className="viewer-image" onTouchStart={e => { touchX.current = e.touches[0].clientX; }} onTouchEnd={e => {
      if (touchX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchX.current;
      if (Math.abs(delta) > 45 && images.length > 1) change(delta > 0 ? -1 : 1);
      touchX.current = null;
    }}><img src={imageUrl(images[index].src)} alt={`${label} 实拍 ${index + 1}`} /></div>
    <div className="viewer-controls"><button onClick={() => change(-1)} disabled={images.length < 2} aria-label="上一张"><ChevronLeft size={23} /></button><span>{index + 1} / {images.length}</span><button onClick={() => change(1)} disabled={images.length < 2} aria-label="下一张"><ChevronRight size={23} /></button></div>
    <p>{label}</p>
  </dialog>;
}
