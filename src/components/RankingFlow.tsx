import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, ImagePlus, Smile, Meh, Frown, X } from 'lucide-react';
import type { Restaurant } from '../data/restaurants';
import { sentimentLabel, type FoodStateController, type Sentiment, type VisitLog } from '../state/useFoodState';
import { readPhoto, savePhoto } from '../state/photos';

export function RankingFlow({ restaurant, food, onClose, mode = 'visit' }: { restaurant: Restaurant; food: FoodStateController; mode?: 'visit' | 'rerank'; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const existing = food.getLog(restaurant.id);
  const [step, setStep] = useState<'sentiment' | 'metadata' | 'compare' | 'result'>('sentiment');
  const [log, setLog] = useState<VisitLog>((mode === 'rerank' ? existing : null) || { sentiment: 'liked', category: 'Restaurants', notes: '', tags: [], dishes: [], visitedAt: '', photoIds: [] });
  const [bounds, setBounds] = useState({ low: 0, high: 0 });
  const [history, setHistory] = useState<{ low: number; high: number }[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const touch = useRef<number | null>(null);
  const peers = food.ranked.filter(row => row.restaurant.id !== restaurant.id && row.sentiment === log.sentiment);
  const middle = Math.floor((bounds.low + bounds.high) / 2);
  const opponent = peers[middle]?.restaurant;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    let alive = true; const urls: string[] = [];
    Promise.all(log.photoIds.map(readPhoto)).then(blobs => { for (const blob of blobs) if (blob) urls.push(URL.createObjectURL(blob)); if (alive) setPhotoUrls(urls); else urls.forEach(URL.revokeObjectURL); }).catch(() => setError('照片暂时无法读取'));
    return () => { alive = false; urls.forEach(URL.revokeObjectURL); };
  }, [log.photoIds]);
  const finish = (position: number) => { food.completeRanking(restaurant.id, { ...log, tags: log.tags.map(s => s.trim()).filter(Boolean), dishes: log.dishes.map(s => s.trim()).filter(Boolean) }, position, mode === 'visit'); setStep('result'); };
  const beginCompare = () => { setHistory([]); setBounds({ low: 0, high: peers.length }); if (peers.length) setStep('compare'); else finish(0); };
  const choose = (preferNew: boolean) => {
    const next = preferNew ? { low: bounds.low, high: middle } : { low: middle + 1, high: bounds.high };
    setHistory(old => [...old, bounds]); setBounds(next);
    if (next.low >= next.high) finish(next.low);
  };
  return <dialog ref={dialog} className="ranking-flow" aria-label="餐厅排名" onCancel={onClose}>
    <header className="ranking-flow-head"><button className="icon-button" onClick={() => step === 'metadata' ? setStep('sentiment') : onClose()} aria-label="返回"><ArrowLeft size={20} /></button><div><strong>{restaurant.brand}</strong><small>{restaurant.cuisineTags.slice(0, 2).join(' · ') || restaurant.actualCity}</small></div><button className="icon-button" onClick={onClose} aria-label="关闭排名"><X size={20} /></button></header>
    <div className="ranking-category">Add to my list of <select aria-label="排名分类" value={log.category} onChange={e => setLog({ ...log, category: e.target.value })}><option>Restaurants</option></select></div>
    <section className="sentiment-panel"><h2>How was it?</h2><div className="sentiment-options">{(['liked', 'fine', 'disliked'] as Sentiment[]).map(value => { const Icon = value === 'liked' ? Smile : value === 'fine' ? Meh : Frown; return <button key={value} className={`sentiment-${value} ${step !== 'sentiment' && log.sentiment === value ? 'chosen' : ''}`} onClick={() => { setLog({ ...log, sentiment: value }); setStep('metadata'); }}><span>{step !== 'sentiment' && log.sentiment === value ? <Check size={23} /> : <Icon size={23} />}</span><small>{sentimentLabel[value]}</small></button>; })}</div></section>
    {step === 'metadata' && <div className="ranking-metadata"><h2>记录这次用餐 <small>全部选填</small></h2><label>Notes<textarea placeholder="想记住什么？" value={log.notes} onChange={e => setLog({ ...log, notes: e.target.value })} /></label><label>Labels<input placeholder="用逗号分隔，例如：约会、聚餐" value={log.tags.join('，')} onChange={e => setLog({ ...log, tags: e.target.value.split(/[,，]/) })} /></label><label>Favorite dishes<input placeholder="用逗号分隔菜品" value={log.dishes.join('，')} onChange={e => setLog({ ...log, dishes: e.target.value.split(/[,，]/) })} /></label><label>分店<input placeholder="这次去了哪家分店？" value={log.branch || ''} onChange={e => setLog({ ...log, branch: e.target.value })} /></label><label>Visit date<input aria-label="到访日期" type="date" value={log.visitedAt} onChange={e => setLog({ ...log, visitedAt: e.target.value })} /></label><label className="photo-upload"><ImagePlus size={19} />{uploading ? '正在保存照片…' : `添加照片 · ${log.photoIds.length}/12`}<input aria-label="添加用餐照片" type="file" accept="image/*" multiple disabled={uploading} onChange={async e => { const files = Array.from(e.target.files || []).slice(0, 12 - log.photoIds.length); setUploading(true); setError(''); try { const ids = await Promise.all(files.map(savePhoto)); setLog(old => ({ ...old, photoIds: [...old.photoIds, ...ids] })); } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); } finally { setUploading(false); } }} /></label>{photoUrls.length > 0 && <div className="logging-photos">{photoUrls.map((url, index) => <div key={url}><img src={url} alt={`新增用餐照片 ${index + 1}`} /><button onClick={() => setLog({ ...log, photoIds: log.photoIds.filter((_, i) => i !== index) })} aria-label={`移除照片 ${index + 1}`}><X size={12} /></button></div>)}</div>}{error && <p className="form-error">{error}</p>}<button className="primary full" disabled={uploading} onClick={beginCompare}>{food.getScore(restaurant.id) === null ? '下一步，开始排名' : '下一步，更新排名'} <ChevronRight size={16} /></button>{mode === 'visit' && <button className="save-visit-only" disabled={uploading} onClick={() => { food.saveVisit(restaurant.id, log); setSavedOnly(true); setStep('result'); }}>仅保存这次用餐，保留现有排名</button>}</div>}
    {step === 'compare' && opponent && <div className="ranking-comparison"><h2>Which do you prefer?</h2><p>和你同样感受的餐厅比较</p><div className="ranking-pair" onTouchStart={e => { touch.current = e.touches[0].clientX; }} onTouchEnd={e => { if (touch.current === null) return; const delta = e.changedTouches[0].clientX - touch.current; if (Math.abs(delta) > 70) choose(delta < 0); touch.current = null; }}><button onClick={() => choose(true)}><strong>{restaurant.brand}</strong><small>{restaurant.actualCity}</small></button><span>OR</span><button onClick={() => choose(false)}><strong>{opponent.brand}</strong><small>{opponent.actualCity}</small></button></div><div className="comparison-tools"><button disabled={!history.length} onClick={() => { setBounds(history.at(-1)!); setHistory(history.slice(0, -1)); }}>Undo</button><button onClick={onClose}>Skip for now</button></div><p className="subtle">太难比较时可暂时退出；本次草稿不会更改排名。</p></div>}
    {step === 'result' && <div className="ranking-result"><span className="result-check"><Check size={30} /></span><h2>{savedOnly ? '用餐记录已保存' : 'Added to Been'}</h2><p>{restaurant.brand}</p><strong>{food.getScore(restaurant.id)?.toFixed(1) ?? '—'}</strong>{food.getScore(restaurant.id) !== null && <p>你的第 {food.ranked.findIndex(row => row.restaurant.id === restaurant.id) + 1} 名</p>}<button className="primary full" onClick={onClose}>Done</button><button className="text-button" onClick={() => { food.undoComparison(); onClose(); }}>撤销本次排名</button></div>}
  </dialog>;
}
