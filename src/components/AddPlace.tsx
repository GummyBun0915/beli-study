import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, CirclePlus } from 'lucide-react';
import { isOverseasRegion, regionCountry, regionName, type PlaceRecord, type Restaurant } from '../data/restaurants';
import { amapConfigured, searchPlaces } from '../lib/amap';
import { searchOsmPlaces } from '../lib/osm';

type Provider = 'amap' | 'osm';
const providerLabel: Record<Provider, string> = { amap: '高德', osm: 'OpenStreetMap' };

/** Adds restaurants that are not in the catalogue: AMap for mainland China, OpenStreetMap abroad, or typed in. */
export function AddPlace({ query, searchCity, catalog, visibleIds, onAdd, onOpen, location }: { location?: {lng:number;lat:number}; query: string; searchCity: string; catalog: Restaurant[]; visibleIds: ReadonlySet<string>; onAdd: (place: PlaceRecord) => void; onOpen: (restaurant: Restaurant) => void }) {
  const keyword = query.trim();
  const overseas = isOverseasRegion(searchCity);
  const primary: Provider = overseas || !amapConfigured ? 'osm' : 'amap';
  const alternate: Provider | null = primary === 'amap' ? 'osm' : amapConfigured && searchCity === 'all' ? 'amap' : null;
  const scope = searchCity === 'all' ? '不限地区' : regionName(searchCity);
  const known = useMemo(() => new Map(catalog.map(r => [r.id, r])), [catalog]);
  const knownNames = useMemo(() => new Map(catalog.map(r => [`${normalizeName(r.displayName)}|${normalizeName(r.actualCity)}`, r])), [catalog]);
  const existingFor = (place: PlaceRecord) => known.get(place.id) || knownNames.get(`${normalizeName(place.name)}|${normalizeName(place.city)}`);
  // OSM ranking bias: the centre of the catalogue's restaurants in the chosen region.
  const near = useMemo(() => {
    const points = catalog.filter(r => r.regionSlug === searchCity && r.mapLng !== null && r.mapLat !== null);
    return searchCity === 'all' && location ? location : points.length ? { lng: points.reduce((sum, r) => sum + r.mapLng!, 0) / points.length, lat: points.reduce((sum, r) => sum + r.mapLat!, 0) / points.length } : undefined;
  }, [catalog, searchCity, location]);
  const searchKey = `${searchCity}|${keyword}|${location?.lng ?? ''}|${location?.lat ?? ''}`;
  const [found, setFound] = useState<{ key: string; provider: Provider; loading: boolean; results: PlaceRecord[]; error: string } | null>(null);
  const [manual, setManual] = useState<{ name: string; city: string; address: string; country: string } | null>(null);
  const requestId = useRef(0);

  const run = (provider: Provider) => {
    if (!keyword) return;
    const key = searchKey;
    const id = ++requestId.current;
    setFound({ key, provider, loading: true, results: [], error: '' });
    const request = provider === 'amap' ? searchPlaces(keyword, searchCity === 'all' ? undefined : regionName(searchCity), searchCity === 'all' ? location : undefined) : searchOsmPlaces(keyword, near, regionCountry(searchCity));
    request
      .then(results => { if (requestId.current === id) setFound(current => current?.key === key && current.provider === provider ? { ...current, loading: false, results } : current); })
      .catch((error: unknown) => { if (requestId.current === id) setFound(current => current?.key === key && current.provider === provider ? { ...current, loading: false, error: error instanceof Error ? error.message : '搜索失败' } : current); });
  };

  useEffect(() => {
    const chars = Array.from(keyword).length;
    const id = ++requestId.current;
    if (!keyword) { setFound(null); return; }
    if (chars < 2) { setFound({ key: searchKey, provider: primary, loading: false, results: [], error: '再输入一个字开始搜索' }); return; }
    setFound({ key: searchKey, provider: primary, loading: true, results: [], error: '' });
    const timer = window.setTimeout(() => {
      const request = primary === 'amap' ? searchPlaces(keyword, searchCity === 'all' ? undefined : regionName(searchCity), searchCity === 'all' ? location : undefined) : searchOsmPlaces(keyword, near, regionCountry(searchCity));
      request
        .then(results => { if (requestId.current === id) setFound(current => current?.key === searchKey && current.provider === primary ? { ...current, loading: false, results } : current); })
        .catch((error: unknown) => { if (requestId.current === id) setFound(current => current?.key === searchKey && current.provider === primary ? { ...current, loading: false, error: error instanceof Error ? error.message : '搜索失败' } : current); });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [keyword, searchCity, primary, near, searchKey]);
  const addManual = () => {
    if (!manual?.name.trim() || !manual.city.trim()) return;
    onAdd({ id: `manual:${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`, source: 'manual', poiId: '', name: manual.name.trim().slice(0, 120),
      address: manual.address.trim().slice(0, 300), city: manual.city.trim().slice(0, 60), district: '', type: '', country: manual.country, lng: null, lat: null, addedAt: new Date().toISOString() });
  };

  if (!keyword) return null;
  const state = found?.key === searchKey ? found : null;
  return <section className="add-place" aria-label="餐厅搜索结果">
    {!state ? <p className="add-place-status">输入店名，自动搜索{providerLabel[primary]} · {scope}</p>
      : state.loading ? <p className="add-place-status">正在搜索{providerLabel[state.provider]} · {scope}…</p>
      : state.error === '再输入一个字开始搜索' ? <p className="add-place-status">{state.error}</p>
      : state.error ? <p className="add-place-status error">{state.error} <button onClick={() => run(state.provider)}>重试</button></p>
      : !state.results.some(place => { const existing = existingFor(place); return !existing || !visibleIds.has(existing.id); }) ? <p className="add-place-status">没有找到新的餐厅；已收录的匹配项显示在上方。</p>
      : <>
        <div className="search-results-title"><strong>{providerLabel[state.provider]} · {state.results.filter(place => { const existing = existingFor(place); return !existing || !visibleIds.has(existing.id); }).length} 个结果</strong></div>
        <div className="restaurant-list">{state.results.filter(place => { const existing = existingFor(place); return !existing || !visibleIds.has(existing.id); }).map(place => {
          const existing = existingFor(place);
          return <article key={place.id} className="restaurant-row place-row"><div className="row-main"><span className="row-text"><strong>{place.name}</strong><span className="info-line">{[place.city.replace(/市$/, ''), place.district, place.type.split(';').at(-1)].filter(Boolean).join(' · ')}</span>{place.address && <small className="place-address">{place.address}</small>}</span></div>
            <div className="row-actions">{existing ? <button onClick={() => onOpen(existing)}>已加入 · 查看 <ChevronRight size={15} /></button> : <button onClick={() => onAdd(searchCity === 'all' ? place : { ...place, regionSlug: searchCity })}>添加这家 <CirclePlus size={15} /></button>}</div></article>;
        })}</div>
        {state.provider === 'osm' && <p className="place-credit">数据 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap 贡献者</a> · 搜索 Photon</p>}
      </>}
    <div className="add-place-links">
      {alternate && <button onClick={() => run(alternate)}>{alternate === 'osm' ? '改用 OpenStreetMap 搜' : '改用高德搜索'}</button>}
      {!manual && <button onClick={() => setManual({ name: keyword, city: searchCity === 'all' ? '' : regionName(searchCity), address: '', country: regionCountry(searchCity) || (searchCity === 'all' ? '' : 'CN') })}>都搜不到？手动添加</button>}
    </div>
    {manual && <form className="add-place-form" onSubmit={event => { event.preventDefault(); addManual(); }}>
      <label>店名<input value={manual.name} maxLength={120} onChange={e => setManual({ ...manual, name: e.target.value })} required /></label>
      <label>国家 / 地区<select aria-label="国家 / 地区" value={manual.country} onChange={e => setManual({ ...manual, country: e.target.value })}><option value="">其他 / 未指定</option><option value="CN">中国大陆</option><option value="JP">日本</option><option value="SG">新加坡</option><option value="TH">泰国</option></select></label>
      <label>城市<input value={manual.city} maxLength={60} placeholder="例如：东京、曼谷" onChange={e => setManual({ ...manual, city: e.target.value })} required /></label>
      <label>地址 <small>选填</small><input value={manual.address} maxLength={300} onChange={e => setManual({ ...manual, address: e.target.value })} /></label>
      <p>手动添加的店没有坐标，不会出现在地图上。</p>
      <div><button type="button" onClick={() => setManual(null)}>取消</button><button type="submit" className="primary" disabled={!manual.name.trim() || !manual.city.trim()}>添加</button></div>
    </form>}
  </section>;
}

function normalizeName(value: string) { return value.toLocaleLowerCase().replace(/[\s·・,，.。()（）\-—]/g, '').replace(/[市区县]$/, ''); }
