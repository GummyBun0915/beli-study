import type { PlaceRecord } from '../data/restaurants';

// AMap JS API 2.0. The key and security code end up in the bundle by design;
// abuse is limited by the domain whitelist in the AMap console.
const key = import.meta.env.VITE_AMAP_KEY as string | undefined;
const security = import.meta.env.VITE_AMAP_SECURITY as string | undefined;
export const amapConfigured = Boolean(key);

declare global { interface Window { AMap?: any; _AMapSecurityConfig?: { securityJsCode: string } } }

let loading: Promise<any> | null = null;
function loadAmap(): Promise<any> {
  if (!key) return Promise.reject(new Error('高德搜索尚未配置'));
  if (window.AMap?.PlaceSearch) return Promise.resolve(window.AMap);
  loading ??= new Promise((resolve, reject) => {
    if (security) window._AMapSecurityConfig = { securityJsCode: security };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.PlaceSearch`;
    script.onload = () => window.AMap?.PlaceSearch ? resolve(window.AMap) : reject(new Error('高德搜索组件未载入'));
    script.onerror = () => { loading = null; script.remove(); reject(new Error('无法连接高德，请稍后重试')); };
    document.head.append(script);
  });
  return loading;
}

function toPlace(poi: any, addedAt: string): PlaceRecord | null {
  const poiId = String(poi?.id ?? '');
  if (!/^[A-Za-z0-9]{1,40}$/.test(poiId) || typeof poi.name !== 'string') return null;
  const lng = Number(poi.location?.lng ?? poi.location?.getLng?.());
  const lat = Number(poi.location?.lat ?? poi.location?.getLat?.());
  const located = Number.isFinite(lng) && Number.isFinite(lat) && (lng !== 0 || lat !== 0);
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  return { id: `amap:${poiId}`, poiId, name: poi.name, address: text(poi.address), city: text(poi.cityname) || text(poi.pname),
    district: text(poi.adname), type: text(poi.type), lng: located ? lng : null, lat: located ? lat : null, addedAt };
}

/** Restaurant POIs only (高德分类「餐饮服务」). `city` limits results when given. */
export async function searchPlaces(keyword: string, city?: string): Promise<PlaceRecord[]> {
  const AMap = await loadAmap();
  return new Promise((resolve, reject) => {
    const search = new AMap.PlaceSearch({ type: '餐饮服务', pageSize: 20, pageIndex: 1, city: city || '全国', citylimit: Boolean(city), extensions: 'base' });
    search.search(keyword, (status: string, result: any) => {
      if (status === 'no_data') return resolve([]);
      if (status !== 'complete') return reject(new Error(result === 'INVALID_USER_DOMAIN' ? '当前网址不在高德 key 的域名白名单内' : typeof result === 'string' ? `高德搜索失败：${result}` : '高德搜索失败'));
      const addedAt = new Date().toISOString();
      resolve((result?.poiList?.pois || []).map((poi: any) => toPlace(poi, addedAt)).filter(Boolean));
    });
  });
}
