import { useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Restaurant } from '../data/restaurants';
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

const utensilSvg = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 2v7a3 3 0 0 0 6 0V2M7 2v20M18 2v20M18 2c-4 3-4 9 0 11"/></svg>';

function markerIcon(score: number | null): L.DivIcon {
  const hasScore = score !== null && Number.isFinite(score);
  const scoreText = hasScore ? score.toFixed(1) : '';
  return L.divIcon({
    className: 'beli-map-pin',
    html: `<span class="beli-map-pin__bubble">${utensilSvg}</span>${hasScore ? `<span class="beli-map-pin__score">${scoreText}</span>` : ''}`,
    iconSize: hasScore ? [58, 30] : [30, 30],
    iconAnchor: hasScore ? [29, 27] : [15, 27],
  });
}

export function MapPane({ restaurants, activeId, onSelect, getScore, citySlug }: MapPaneProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const basemapRef = useRef<L.MaplibreGL | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const basemapLoadedRef = useRef(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  onSelectRef.current = onSelect;

  const located = useMemo(() => restaurants.filter((restaurant) =>
    restaurant.mapLat !== null && restaurant.mapLng !== null &&
    Number.isFinite(restaurant.mapLat) && Number.isFinite(restaurant.mapLng)), [restaurants]);
  const unlocatedCount = restaurants.length - located.length;
  const boundsKey = `${citySlug ?? ''}|${located.map((restaurant) =>
    `${restaurant.id}:${restaurant.mapLat}:${restaurant.mapLng}`).join('|')}`;

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
      const marker = L.marker([lat, lng], {
        icon: markerIcon(score),
        title: restaurant.displayName,
        alt: `在地图上选择${restaurant.displayName}`,
        keyboard: true,
        riseOnHover: true,
      }).addTo(layer);
      marker.on('click', () => onSelectRef.current(restaurant.id));
      marker.on('add', () => {
        marker.getElement()?.setAttribute('aria-label', `选择${restaurant.displayName}${score === null ? '' : `，个人评分${score.toFixed(1)}`}`);
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
    if (located.length === 0) {
      map.setView([20, 0], 2, { animate: false });
    } else if (located.length === 1) {
      const only = located[0];
      map.setView([only.mapLat!, only.mapLng!], 12, { animate: false });
    } else {
      map.fitBounds(L.latLngBounds(located.map((restaurant) =>
        [restaurant.mapLat!, restaurant.mapLng!] as L.LatLngTuple)), {
        padding: [48, 48],
        maxZoom: 13,
        animate: false,
      });
    }
  // boundsKey tracks location and filter changes without resetting the map after a score update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

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

  function showAllLocations() {
    const map = mapRef.current;
    if (!map) return;
    if (located.length === 0) map.setView([20, 0], 2);
    else if (located.length === 1) map.setView([located[0].mapLat!, located[0].mapLng!], 12);
    else map.fitBounds(L.latLngBounds(located.map((restaurant) =>
      [restaurant.mapLat!, restaurant.mapLng!] as L.LatLngTuple)), { padding: [48, 48], maxZoom: 13 });
  }

  return (
    <section className="beli-map" aria-label="餐厅地图">
      <div className="beli-map__canvas" ref={canvasRef} />
      <div className="beli-map__tools">
        <button className="beli-map__reset" type="button" onClick={showAllLocations}>查看全部位置</button>
      </div>
      {unlocatedCount > 0 && (
        <div className="beli-map__unlocated" role="status">
          {unlocatedCount} 家暂无准确坐标，仍可在列表查看
        </div>
      )}
      {located.length === 0 && (
        <div className="beli-map__empty" role="status">当前筛选没有可定位的餐厅<br /><span>请切到列表查看全部结果</span></div>
      )}
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
    </section>
  );
}

export default MapPane;
