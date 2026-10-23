import { useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, CirclePlus, MapPin } from 'lucide-react';
import { isOverseasRegion, regionCountry, regionName, type PlaceRecord, type Restaurant } from '../data/restaurants';
import { amapConfigured, searchPlaces } from '../lib/amap';
import { searchOsmPlaces } from '../lib/osm';

type Provider = 'amap' | 'osm';
const providerLabel: Record<Provider, string> = { amap: '高德', osm: 'OpenStreetMap' };

/** Adds restaurants that are not in the catalogue: AMap for mainland China, OpenStreetMap abroad, or typed in. */
export function AddPlace({ query, searchCity, catalog, onAdd, onOpen }: { query: string; searchCity: string; catalog: Restaurant[]; onAdd: (place: PlaceRecord) => void; onOpen: (restaurant: Restaurant) => void }) {
  const keyword = query.trim();
  const overseas = isOverseasRegion(searchCity);
  const primary: Provider = overseas || !amapConfigured ? 'osm' : 'amap';
  const alternate: Provider | null = primary === 'amap' ? 'osm' : amapConfigured && searchCity === 'all' ? 'amap' : null;
  const scope = searchCity === 'all' ? '不限地区' : regionName(searchCity);
  const known = useMemo(() => new Map(catalog.map(r => [r.id, r])), [catalog]);
  // OSM ranking bias: the centre of the catalogue's restaurants in the chosen region.
  const near = useMemo(() => {
    const points = catalog.filter(r => r.regionSlug === searchCity && r.mapLng !== null && r.mapLat !== null);
    return points.length ? { lng: points.reduce((sum, r) => sum + r.mapLng!, 0) / points.length, lat: points.reduce((sum, r) => sum + r.mapLat!, 0) / points.length } : undefined;
  }, [catalog, searchCity]);
  const searchKey = `${searchCity}|${keyword}`;
  const [found, setFound] = useState<{ key: string; provider: Provider; loading: boolean; results: PlaceRecord[]; error: string } | null>(null);
  const [manual, setManual] = useState<{ name: string; city: string; address: string } | null>(null);

  const run = (provider: Provider) => {
    if (!keyword) return;
    const key = searchKey;
    setFound({ key, provider, loading: true, results: [], error: '' });
    const request = provider === 'amap' ? searchPlaces(keyword, searchCity === 'all' ? undefined : regionName(searchCity)) : searchOsmPlaces(keyword, near, regionCountry(searchCity));
    request
      .then(results => setFound(current => current?.key === key && current.provider === provider ? { ...current, loading: false, results } : current))
      .catch((error: unknown) => setFound(current => current?.key === key && current.provider === provider ? { ...current, loading: false, error: error instanceof Error ? error.message : '搜索失败' } : current));
  };
  const addManual = () => {
    if (!manual?.name.trim() || !manual.city.trim()) return;
    onAdd({ id: `manual:${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`, source: 'manual', poiId: '', name: manual.name.trim().slice(0, 120),
      address: manual.address.trim().slice(0, 300), city: manual.city.trim().slice(0, 60), district: '', type: '', country: '', lng: null, lat: null, addedAt: new Date().toISOString() });
  };

  if (!keyword) return null;
  const state = found?.key === searchKey ? found : null;
  return <section className="add-place" aria-label="添加新餐厅">
    {!state ? <button className="add-place-trigger" onClick={() => run(primary)}><MapPin size={16} /><span>没找到？在{providerLabel[primary]}搜索「{keyword}」<small>{scope} · 只搜餐饮</small></span><ChevronRight size={16} /></button>
      : state.loading ? <p className="add-place-status">正在搜索{providerLabel[state.provider]}…</p>
      : state.error ? <p className="add-place-status error">{state.error} <button onClick={() => run(state.provider)}>重试</button></p>
      : !state.results.length ? <p className="add-place-status">{providerLabel[state.provider]}也没有找到匹配的餐厅。</p>
      : <>
        <div className="search-results-title"><strong>{providerLabel[state.provider]} · {state.results.length} 个结果</strong></div>
        <div className="restaurant-list">{state.results.map(place => {
          const existing = known.get(place.id);
          return <article key={place.id} className="restaurant-row place-row"><div className="row-main"><span className="row-text"><strong>{place.name}</strong><span className="info-line">{[place.city.replace(/市$/, ''), place.district, place.type.split(';').at(-1)].filter(Boolean).join(' · ')}</span>{place.address && <small className="place-address">{place.address}</small>}</span></div>
            <div className="row-actions">{existing ? <button onClick={() => onOpen(existing)}>已添加 · 查看 <ArrowRight size={15} /></button> : <button onClick={() => onAdd(place)}>添加这家 <CirclePlus size={15} /></button>}</div></article>;
        })}</div>
        {state.provider === 'osm' && <p className="place-credit">数据 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap 贡献者</a> · 搜索 Photon</p>}
      </>}
    <div className="add-place-links">
      {alternate && <button onClick={() => run(alternate)}>{alternate === 'osm' ? '海外的店？改用 OpenStreetMap 搜' : '国内的店？改用高德搜'}</button>}
      {!manual && <button onClick={() => setManual({ name: keyword, city: searchCity === 'all' ? '' : regionName(searchCity), address: '' })}>都搜不到？手动添加</button>}
    </div>
    {manual && <form className="add-place-form" onSubmit={event => { event.preventDefault(); addManual(); }}>
      <label>店名<input value={manual.name} maxLength={120} onChange={e => setManual({ ...manual, name: e.target.value })} required /></label>
      <label>城市<input value={manual.city} maxLength={60} placeholder="例如：东京、曼谷" onChange={e => setManual({ ...manual, city: e.target.value })} required /></label>
      <label>地址 <small>选填</small><input value={manual.address} maxLength={300} onChange={e => setManual({ ...manual, address: e.target.value })} /></label>
      <p>手动添加的店没有坐标，不会出现在地图上。</p>
      <div><button type="button" onClick={() => setManual(null)}>取消</button><button type="submit" className="primary" disabled={!manual.name.trim() || !manual.city.trim()}>添加</button></div>
    </form>}
  </section>;
}
