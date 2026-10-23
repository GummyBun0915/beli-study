/**
 * Faithful, read-only adapter for dachitech's public data projection.
 * Source records are retained in full; derived fields exist only for this UI.
 */
import projection from './restaurants.generated.json';

export type GuideLevel = 's3' | 's2' | 's1' | 'bib' | 'sel' | 'tbd' | 'daiChi';
export type CoordinateSystem = 'GCJ02' | 'WGS84' | null;

export interface PublishedDish {
  name: string;
  review?: string;
  score10?: number | null;
}

export interface PublishedImage {
  src: string;
  thumb: string;
  w: number;
  h: number;
  pos: string;
}

export interface PublishedBranch {
  id: string;
  name: string;
  address: string;
  lng: number | null;
  lat: number | null;
  score10: number | null;
  visitedAt: string | null;
  closed: boolean;
  amapQuery: string;
}

export interface PublishedRestaurant {
  id: string;
  slug: string;
  regionSlug: string;
  actualCity: string;
  brand: string;
  branch: string | null;
  category: string | null;
  cuisineTags: string[];
  reviewText: string;
  dishes: PublishedDish[];
  score10: number | null;
  scoreScope: 'restaurant' | 'none';
  recommendationLevel: GuideLevel;
  visitedAt: string | null;
  visitedAtPrecision: 'day' | 'month' | null;
  inRecent: boolean;
  multiShop: boolean;
  amapQuery: string;
  lng: number | null;
  lat: number | null;
  coordSystem: CoordinateSystem;
  poiConfidence: string | null;
  closed: boolean;
  avgPrice: number | null;
  branches: PublishedBranch[];
  address: string;
  contentUpdatedAt: string;
  images: PublishedImage[];
  coverImage: string | null;
}

export interface PublishedRegion {
  slug: string;
  name: string;
  count: number;
  wait: number;
}

export interface PublishedProjection {
  generatedAt: string;
  policyVersion: string;
  recentWindowDays: number;
  source: string;
  regions: PublishedRegion[];
  restaurants: PublishedRestaurant[];
}

const data = projection as unknown as PublishedProjection;
export const sourceProjection = data;
export const regions = data.regions;

export const guideOrder: GuideLevel[] = ['s3', 's2', 's1', 'bib', 'sel', 'tbd', 'daiChi'];
export const guideLabel: Record<GuideLevel, string> = {
  s3: '三星',
  s2: '二星',
  s1: '一星',
  bib: '星推介',
  sel: '星选',
  tbd: '待定级',
  daiChi: '待吃',
};

const overseasRegions = new Set(['japan', 'singapore', 'thailand']);
export const isOverseasRegion = (slug: string): boolean => overseasRegions.has(slug);
const regionByCountry: Record<string, string> = { JP: 'japan', SG: 'singapore', TH: 'thailand' };
export const regionCountry = (slug: string): string | undefined => Object.keys(regionByCountry).find(code => regionByCountry[code] === slug);
const pi = Math.PI;
const a = 6378245.0;
const ee = 0.00669342162296594323;

export function outsideChina(lng: number, lat: number): boolean {
  return lng < 73.66 || lng > 135.05 || lat < 3.86 || lat > 53.55;
}

function transformLat(x: number, y: number): number {
  let result = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  result += (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3;
  result += (20 * Math.sin(y * pi) + 40 * Math.sin(y / 3 * pi)) * 2 / 3;
  result += (160 * Math.sin(y / 12 * pi) + 320 * Math.sin(y * pi / 30)) * 2 / 3;
  return result;
}

function transformLng(x: number, y: number): number {
  let result = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result += (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3;
  result += (20 * Math.sin(x * pi) + 40 * Math.sin(x / 3 * pi)) * 2 / 3;
  result += (150 * Math.sin(x / 12 * pi) + 300 * Math.sin(x / 30 * pi)) * 2 / 3;
  return result;
}

export function wgs84ToGcj02(lng: number, lat: number): { lng: number; lat: number } {
  if (outsideChina(lng, lat)) return { lng, lat };
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = lat / 180 * pi;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = dLat * 180 / ((a * (1 - ee)) / (magic * sqrtMagic) * pi);
  dLng = dLng * 180 / (a / sqrtMagic * Math.cos(radLat) * pi);
  return { lng: lng + dLng, lat: lat + dLat };
}

/** Convert a GCJ-02 point for WGS84 basemaps without touching the source. */
export function gcj02ToWgs84(lng: number, lat: number): { lng: number; lat: number } {
  if (outsideChina(lng, lat)) return { lng, lat };
  let guessLng = lng;
  let guessLat = lat;
  for (let i = 0; i < 3; i += 1) {
    const forward = wgs84ToGcj02(guessLng, guessLat);
    guessLng += lng - forward.lng;
    guessLat += lat - forward.lat;
  }
  return { lng: guessLng, lat: guessLat };
}

export interface Restaurant extends PublishedRestaurant {
  displayName: string;
  status: 'been' | 'want';
  isVisited: boolean;
  isWantToTry: boolean;
  mapPoint: { lng: number; lat: number } | null;
  mapLng: number | null;
  mapLat: number | null;
  coverUrl: string | null;
  searchText: string;
  navigationUrl: string;
  navigationProvider: '高德地图' | 'Google 地图';
  /** Present for restaurants a member added from an AMap POI search. */
  place?: PlaceRecord;
}

/** A restaurant a member added (AMap / OpenStreetMap search, or typed in); stored inside the adder's synced snapshot. */
export interface PlaceRecord {
  /** `<source>:<source id>` */
  id: string;
  source: PlaceSource;
  poiId: string;
  name: string;
  address: string;
  city: string;
  district: string;
  type: string;
  /** ISO 3166 alpha-2, '' when unknown. */
  country: string;
  /** GCJ-02 for amap, WGS-84 otherwise. */
  lng: number | null;
  lat: number | null;
  addedAt: string;
}
export type PlaceSource = 'amap' | 'osm' | 'manual';
export const isPlaceId = (id: string): boolean => /^(amap|osm|manual):[A-Za-z0-9]{1,40}$/.test(id);

/** Published image paths omit the site root. */
export const imageUrl = (relativePath: string): string => /^(blob:|data:|https?:)/.test(relativePath) ? relativePath : `${import.meta.env.BASE_URL}${relativePath}`;

function normalize(record: PublishedRestaurant): Restaurant {
  const isOverseas = overseasRegions.has(record.regionSlug);
  const mapPoint = record.lng === null || record.lat === null
    ? null
    : record.coordSystem === 'GCJ02'
      ? gcj02ToWgs84(record.lng, record.lat)
      : { lng: record.lng, lat: record.lat };
  return {
    ...record,
    displayName: record.branch ? `${record.brand} · ${record.branch}` : record.brand,
    status: record.recommendationLevel === 'daiChi' ? 'want' : 'been',
    isVisited: record.recommendationLevel !== 'daiChi',
    isWantToTry: record.recommendationLevel === 'daiChi',
    mapPoint,
    mapLng: mapPoint?.lng ?? null,
    mapLat: mapPoint?.lat ?? null,
    coverUrl: record.coverImage ? imageUrl(record.coverImage) : null,
    searchText: [record.brand, record.branch, record.actualCity, record.address,
      ...record.cuisineTags, ...record.dishes.map((dish) => dish.name)]
      .filter(Boolean).join(' ').toLocaleLowerCase(),
    navigationUrl: isOverseas
      ? `https://www.google.com/maps/search/?api=1&query=${record.amapQuery}`
      : `https://uri.amap.com/search?keyword=${record.amapQuery}`,
    navigationProvider: isOverseas ? 'Google 地图' : '高德地图',
  };
}

export const restaurants: Restaurant[] = data.restaurants.map(normalize);

/** Added places start as no-status for everyone. */
export function placeToRestaurant(place: PlaceRecord): Restaurant {
  const city = place.city.replace(/市$/, '');
  const region = regions.find(r => r.slug === regionByCountry[place.country])
    ?? (city ? regions.find(r => city.startsWith(r.name) || r.name.startsWith(city)) : undefined);
  const kind = place.type.split(';').filter(Boolean).at(-1) || '';
  const address = [place.district, place.address].filter(Boolean).join(' ');
  const query = encodeURIComponent(`${place.name} ${place.address || city}`.trim());
  const inChina = place.source === 'amap' || place.country === 'CN' || (!place.country && !!region && !overseasRegions.has(region.slug));
  return { ...normalize({
    id: place.id, slug: place.id, regionSlug: region?.slug ?? (city || '其他'), actualCity: city,
    brand: place.name, branch: null, category: kind || null, cuisineTags: kind ? [kind] : [], reviewText: '', dishes: [],
    score10: null, scoreScope: 'none', recommendationLevel: 'daiChi', visitedAt: null, visitedAtPrecision: null, inRecent: false,
    multiShop: false, amapQuery: query, lng: place.lng, lat: place.lat,
    coordSystem: place.lng === null ? null : place.source === 'amap' ? 'GCJ02' : 'WGS84', poiConfidence: place.source, closed: false, avgPrice: null, branches: [],
    address, contentUpdatedAt: place.addedAt, images: [], coverImage: null,
  }), status: 'want', isVisited: false, isWantToTry: false, place,
  navigationUrl: inChina ? `https://uri.amap.com/search?keyword=${query}` : `https://www.google.com/maps/search/?api=1&query=${query}`,
  navigationProvider: inChina ? '高德地图' : 'Google 地图' };
}

/** `base` plus any places it does not already contain. */
export function mergePlaces(base: Restaurant[], places: Iterable<PlaceRecord>): Restaurant[] {
  const ids = new Set(base.map(r => r.id));
  const added: Restaurant[] = [];
  for (const place of places) if (!ids.has(place.id)) { ids.add(place.id); added.push(placeToRestaurant(place)); }
  return added.length ? [...base, ...added] : base;
}
export const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
export const regionName = (slug: string): string => regions.find((region) => region.slug === slug)?.name ?? slug;

export function formattedVisitDate(restaurant: Restaurant): string | null {
  if (!restaurant.visitedAt) return null;
  if (restaurant.visitedAtPrecision === 'month') {
    const [year, month] = restaurant.visitedAt.split('-');
    return `${year}.${month}`;
  }
  return restaurant.visitedAt.replaceAll('-', '.');
}
