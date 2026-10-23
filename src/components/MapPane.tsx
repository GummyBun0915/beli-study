import { useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { outsideChina, wgs84ToGcj02, type Restaurant } from '../data/restaurants';
import { amapConfigured, loadAmap } from '../lib/amap';
import './map.css';

// OpenFreeMap's documented Vite setup keeps MapLibre workers on the local dev origin.
setWorkerUrl(workerUrl);
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export interface MapPaneProps {
  restaurants: Restaurant[];
  activeId: string | null;
  onSelect: (id: string) => void;
  getScore: (id: string) => number | null;
  citySlug?: string | null;
}

interface BasemapProps {
  located: Restaurant[];
  activeId: string | null;
  onSelect: (id: string) => void;
  getScore: (id: string) => number | null;
  boundsKey: string;
  /** Incremented by「查看全部位置」. */
  fitSignal: number;
}

const utensilSvg = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 2v7a3 3 0 0 0 6 0V2M7 2v20M18 2v20M18 2c-4 3-4 9 0 11"/></svg>';

/** One pin design for both basemaps. */
function pinSpec(score: number | null) {
  const hasScore = score !== null && Number.isFinite(score);
  return {
    html: `<span class="beli-map-pin__bubble">${utensilSvg}</span>${hasScore ? `<span class="beli-map-pin__score">${score.toFixed(1)}</span>` : ''}`,
    size: (hasScore ? [58, 30] : [30, 30]) as [number, number],
    anchor: (hasScore ? [29, 27] : [15, 27]) as [number, number],
  };
}
const pinLabel = (restaurant: Restaurant, score: number | null) => `选择${restaurant.displayName}${score === null ? '' : `，个人评分${score.toFixed(1)}`}`;

/** GCJ-02 point for AMap; source rows are GCJ-02 unless marked WGS84. */
function gcjPoint(restaurant: Restaurant): [number, number] | null {
  if (restaurant.lng === null || restaurant.lat === null) return null;
  if (restaurant.coordSystem !== 'WGS84') return [restaurant.lng, restaurant.lat];
  const point = wgs84ToGcj02(restaurant.lng, restaurant.lat);
  return [point.lng, point.lat];
}

/** AMap has good coverage only in mainland China and its key is not whitelisted for local hosts. */
function chooseBasemap(located: Restaurant[]): 'amap' | 'osm' {
  if (!amapConfigured) return 'osm';
  const forced = new URLSearchParams(window.location.search).get('map');
  if (forced === 'amap' || forced === 'osm') return forced;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return 'osm';
  return located.length > 0 && located.every(r => r.lng !== null && r.lat !== null && !outsideChina(r.lng, r.lat)) ? 'amap' : 'osm';
}

export function MapPane({ restaurants, activeId, onSelect, getScore, citySlug }: MapPaneProps) {
  const [fitSignal, setFitSignal] = useState(0);
  const [amapFailed, setAmapFailed] = useState(false);
  const located = useMemo(() => restaurants.filter((restaurant) =>
    restaurant.mapLat !== null && restaurant.mapLng !== null &&
    Number.isFinite(restaurant.mapLat) && Number.isFinite(restaurant.mapLng)), [restaurants]);
  const unlocatedCount = restaurants.length - located.length;
  const boundsKey = `${citySlug ?? ''}|${located.map((restaurant) =>
    `${restaurant.id}:${restaurant.mapLat}:${restaurant.mapLng}`).join('|')}`;
  const basemap = amapFailed ? 'osm' : chooseBasemap(located);
  const props: BasemapProps = { located, activeId, onSelect, getScore, boundsKey, fitSignal };

  return (
    <section className="beli-map" aria-label="餐厅地图" data-basemap={basemap}>
      {basemap === 'amap' ? <AmapBasemap {...props} onFail={() => setAmapFailed(true)} /> : <LeafletBasemap {...props} />}
      <div className="beli-map__tools">
        <button className="beli-map__reset" type="button" onClick={() => setFitSignal(n => n + 1)}>查看全部位置</button>
      </div>
      {unlocatedCount > 0 && (
        <div className="beli-map__unlocated" role="status">
          {unlocatedCount} 家暂无准确坐标，仍可在列表查看
        </div>
      )}
      {located.length === 0 && (
        <div className="beli-map__empty" role="status">当前筛选没有可定位的餐厅<br /><span>请切到列表查看全部结果</span></div>
      )}
    </section>
  );
}

function AmapBasemap({ located, activeId, onSelect, getScore, boundsKey, fitSignal, onFail }: BasemapProps & { onFail: () => void }) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, { marker: any; element: HTMLElement }>>(new Map());
  const onSelectRef = useRef(onSelect);
  const onFailRef = useRef(onFail);
  const [ready, setReady] = useState(false);
  onSelectRef.current = onSelect;
  onFailRef.current = onFail;
  const points = useMemo(() => located.flatMap(restaurant => { const point = gcjPoint(restaurant); return point ? [{ restaurant, point }] : []; }), [located]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map || !points.length) return;
    if (points.length === 1) { map.setZoomAndCenter(15, points[0].point, true); return; }
    const lngs = points.map(p => p.point[0]), lats = points.map(p => p.point[1]);
    // Immediate mode: an animated fit would be overridden by the next view change.
    map.setBounds(new window.AMap.Bounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]), true, [60, 48, 60, 48]);
    if (map.getZoom() > 16) map.setZoom(16, true);
  };

  useEffect(() => {
    let cancelled = false;
    loadAmap().then(AMap => {
      if (cancelled || !canvasRef.current) return;
      // A center is required: without it AMap geolocates by IP and overrides our framing.
      const center = points[0]?.point ?? [114.0579, 22.5431];
      mapRef.current = new AMap.Map(canvasRef.current, { zoom: 12, center, viewMode: '2D', resizeEnable: true });
      setReady(true);
    }).catch(() => { if (!cancelled) onFailRef.current(); });
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      markersRef.current.clear();
    };
  // The map is created once; points only seed its first center.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markersRef.current.forEach(({ marker }) => map.remove(marker));
    markersRef.current.clear();
    for (const { restaurant, point } of points) {
      const score = getScore(restaurant.id);
      const spec = pinSpec(score);
      const element = document.createElement('div');
      element.className = `beli-map-pin${restaurant.id === activeId ? ' is-active' : ''}`;
      element.innerHTML = spec.html;
      element.style.width = `${spec.size[0]}px`;
      element.style.height = `${spec.size[1]}px`;
      element.tabIndex = 0;
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', pinLabel(restaurant, score));
      element.title = restaurant.displayName;
      element.addEventListener('click', event => { event.stopPropagation(); onSelectRef.current(restaurant.id); });
      element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectRef.current(restaurant.id); } });
      const marker = new window.AMap.Marker({ position: point, content: element, anchor: 'top-left',
        offset: new window.AMap.Pixel(-spec.anchor[0], -spec.anchor[1]), zIndex: restaurant.id === activeId ? 200 : 100 });
      map.add(marker);
      markersRef.current.set(restaurant.id, { marker, element });
    }
  }, [ready, points, getScore, activeId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) fitAll(); }, [ready, boundsKey, fitSignal]);

  useEffect(() => {
    const map = mapRef.current;
    const active = activeId ? points.find(p => p.restaurant.id === activeId) : null;
    if (!ready || !map || !active) return;
    if (!map.getBounds().contains(active.point)) map.panTo(active.point);
  }, [ready, activeId, points]);

  return <div className="beli-map__canvas" ref={canvasRef} />;
}

function LeafletBasemap({ located, activeId, onSelect, getScore, boundsKey, fitSignal }: BasemapProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const basemapRef = useRef<L.MaplibreGL | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const basemapLoadedRef = useRef(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!canvasRef.current) return;
    basemapLoadedRef.current = false;
    const map = L.map(canvasRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      scrollWheelZoom: false,
    }).setView([20, 0], 2);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false })
      .addAttribution('<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>')
      .addTo(map);
    const basemap = maplibreGL({ style: BASEMAP_STYLE, interactive: false, attributionControl: false }).addTo(map);
    const libreMap = basemap.getMaplibreMap();
    libreMap.on('load', () => {
      basemapLoadedRef.current = true;
      setTilesFailed(false);
    });
    libreMap.on('error', () => {
      if (!basemapLoadedRef.current) setTilesFailed(true);
    });
    const pins = L.layerGroup().addTo(map);
    mapRef.current = map;
    basemapRef.current = basemap;
    pinLayerRef.current = pins;
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
      pinLayerRef.current = null;
      basemapRef.current = null;
      basemapLoadedRef.current = false;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const layer = pinLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    for (const restaurant of located) {
      const lat = restaurant.mapLat;
      const lng = restaurant.mapLng;
      if (lat === null || lng === null) continue;
      const score = getScore(restaurant.id);
      const spec = pinSpec(score);
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'beli-map-pin', html: spec.html, iconSize: spec.size, iconAnchor: spec.anchor }),
        title: restaurant.displayName,
        alt: `在地图上选择${restaurant.displayName}`,
        keyboard: true,
        riseOnHover: true,
      }).addTo(layer);
      marker.on('click', () => onSelectRef.current(restaurant.id));
      marker.on('add', () => {
        marker.getElement()?.setAttribute('aria-label', pinLabel(restaurant, score));
      });
      markersRef.current.set(restaurant.id, marker);
    }
    markersRef.current.forEach((marker, id) => {
      marker.getElement()?.classList.toggle('is-active', id === activeId);
    });
  }, [located, getScore, activeId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const animate = fitSignal > 0;
    if (located.length === 0) {
      map.setView([20, 0], 2, { animate: false });
    } else if (located.length === 1) {
      const only = located[0];
      map.setView([only.mapLat!, only.mapLng!], 12, { animate });
    } else {
      map.fitBounds(L.latLngBounds(located.map((restaurant) =>
        [restaurant.mapLat!, restaurant.mapLng!] as L.LatLngTuple)), {
        padding: [48, 48],
        maxZoom: 13,
        animate,
      });
    }
  // boundsKey tracks location and filter changes without resetting the map after a score update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, fitSignal]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      marker.getElement()?.classList.toggle('is-active', id === activeId);
      if (id === activeId) marker.setZIndexOffset(1000);
      else marker.setZIndexOffset(0);
    });
    const marker = activeId ? markersRef.current.get(activeId) : null;
    const map = mapRef.current;
    if (marker && map && !map.getBounds().pad(-0.18).contains(marker.getLatLng())) {
      map.panTo(marker.getLatLng(), { animate: true, duration: 0.35 });
    }
  }, [activeId, located, getScore]);

  return <>
    <div className="beli-map__canvas" ref={canvasRef} />
    {tilesFailed && (
      <div className="beli-map__tile-warning" role="status">
        地图底图暂时没加载出来，餐厅位置和列表仍可用。
        <button type="button" onClick={() => {
          basemapLoadedRef.current = false;
          setTilesFailed(false);
          basemapRef.current?.getMaplibreMap().setStyle(BASEMAP_STYLE);
        }}>重试</button>
      </div>
    )}
  </>;
}

export default MapPane;
