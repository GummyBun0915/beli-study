import type { PlaceRecord } from '../data/restaurants';

// Photon (komoot) geocoder over OpenStreetMap: free, keyless, fair-use. Used where AMap has no coverage.
// Results are OSM data (ODbL), so the UI credits OpenStreetMap next to them.
const ENDPOINT = 'https://photon.komoot.io/api/';
const FOOD_TAGS = ['amenity:restaurant', 'amenity:cafe', 'amenity:fast_food', 'amenity:bar', 'amenity:pub', 'amenity:food_court', 'amenity:ice_cream', 'shop:bakery'];

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

function toPlace(feature: PhotonFeature, addedAt: string): PlaceRecord | null {
  const p = feature.properties || {};
  const type = String(p.osm_type ?? ''), osmId = String(p.osm_id ?? '');
  if (!/^[NWR]$/.test(type) || !/^\d{1,20}$/.test(osmId) || typeof p.name !== 'string' || !p.name.trim()) return null;
  const [lng, lat] = feature.geometry?.coordinates ?? [NaN, NaN];
  const located = Number.isFinite(lng) && Number.isFinite(lat);
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  const street = [text(p.street), text(p.housenumber)].filter(Boolean).join(' ');
  return { id: `osm:${type}${osmId}`, source: 'osm', poiId: `${type}${osmId}`, name: p.name.trim(), address: street,
    city: text(p.city) || text(p.county) || text(p.state), district: text(p.district) || text(p.locality), type: text(p.osm_value),
    country: text(p.countrycode).toUpperCase(), lng: located ? lng : null, lat: located ? lat : null, addedAt };
}

/** Food places matching `keyword`; `near` (WGS-84) biases ranking toward a city, `country` keeps one country's results. */
export async function searchOsmPlaces(keyword: string, near?: { lng: number; lat: number }, country?: string): Promise<PlaceRecord[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', keyword);
  url.searchParams.set('limit', country ? '30' : '15');
  for (const tag of FOOD_TAGS) url.searchParams.append('osm_tag', tag);
  if (near) { url.searchParams.set('lat', near.lat.toFixed(4)); url.searchParams.set('lon', near.lng.toFixed(4)); }
  let response: Response;
  try { response = await fetch(url); } catch { throw new Error('无法连接 OpenStreetMap 搜索，请稍后重试'); }
  if (!response.ok) throw new Error(response.status === 429 ? '搜索太频繁了，稍等一会儿再试' : 'OpenStreetMap 搜索失败');
  const data = await response.json() as { features?: PhotonFeature[] };
  const addedAt = new Date().toISOString();
  return (data.features || []).map(feature => toPlace(feature, addedAt))
    .filter((place): place is PlaceRecord => place !== null && (!country || place.country === country)).slice(0, 15);
}
