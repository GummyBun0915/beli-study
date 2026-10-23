import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Restaurant } from '../data/restaurants';

export type FoodStatus = 'been' | 'want' | 'none';
export type Sentiment = 'liked' | 'fine' | 'disliked';
export interface VisitLog {
  sentiment: Sentiment;
  category: string;
  notes: string;
  tags: string[];
  dishes: string[];
  visitedAt: string;
  photoIds: string[];
  branch?: string;
}
export interface VisitEntry extends VisitLog { id: string; recordedAt: string }
export interface FoodFrame {
  statuses: Record<string, FoodStatus>;
  logs: Record<string, VisitLog>;
  order: string[];
  visits: Record<string, VisitEntry[]>;
}
export interface FoodSnapshot extends FoodFrame {
  version: 2;
  baseline: 'source' | 'empty';
  history: FoodFrame[];
}
export interface RankedRestaurant {
  restaurant: Restaurant;
  score: number;
  sentiment: Sentiment;
  wins: number;
  losses: number;
  comparisons: number;
}
const KEY = 'beli-dachitech:food-state:v2';
const sentiments: Sentiment[] = ['liked', 'fine', 'disliked'];
export const sentimentLabel: Record<Sentiment, string> = { liked: 'I liked it!', fine: 'It was fine', disliked: "I didn’t like it" };
export function emptySnapshot(baseline: 'source' | 'empty' = 'source'): FoodSnapshot {
  return { version: 2, baseline, statuses: {}, logs: {}, order: [], visits: {}, history: [] };
}
function cleanStrings(input: unknown, max = 30): string[] {
  return Array.isArray(input) ? input.filter((v): v is string => typeof v === 'string').map(v => v.slice(0, 300)).slice(0, max) : [];
}
export function normalizeSnapshot(input: unknown, ids: Set<string>): FoodSnapshot {
  if (!input || typeof input !== 'object') return emptySnapshot();
  const raw = input as Partial<FoodSnapshot>;
  const result = emptySnapshot(raw.baseline === 'empty' ? 'empty' : 'source');
  if (raw.version !== 2) return result;
  for (const [id, value] of Object.entries(raw.statuses || {})) {
    if (ids.has(id) && ['been', 'want', 'none'].includes(value)) result.statuses[id] = value;
  }
  for (const [id, value] of Object.entries(raw.logs || {})) {
    if (!ids.has(id) || !value || !sentiments.includes(value.sentiment)) continue;
    result.logs[id] = {
      sentiment: value.sentiment,
      category: typeof value.category === 'string' ? value.category.slice(0, 40) : 'Restaurants',
      notes: typeof value.notes === 'string' ? value.notes.slice(0, 10000) : '',
      branch: typeof value.branch === 'string' ? value.branch.slice(0, 200) : '',
      tags: cleanStrings(value.tags), dishes: cleanStrings(value.dishes), photoIds: cleanStrings(value.photoIds, 12).filter(id => /^[0-9a-f-]{36}$/i.test(id)),
      visitedAt: typeof value.visitedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.visitedAt) ? value.visitedAt : '',
    };
  }
  for (const [id, entries] of Object.entries(raw.visits || {})) {
    if (!ids.has(id) || !Array.isArray(entries)) continue;
    result.visits[id] = entries.slice(-1000).flatMap(entry => {
      if (!entry || typeof entry.id !== 'string' || !sentiments.includes(entry.sentiment)) return [];
      const cleaned = normalizeSnapshot({ version: 2, logs: { [id]: entry }, order: [id] }, ids).logs[id];
      return cleaned ? [{ ...cleaned, id: entry.id.slice(0, 100), recordedAt: typeof entry.recordedAt === 'string' ? entry.recordedAt : '' }] : [];
    });
  }
  result.order = [...new Set(cleanStrings(raw.order, 10000))].filter(id => ids.has(id) && result.logs[id]);
  for (const id of Object.keys(result.logs)) if (!result.order.includes(id)) result.order.push(id);
  result.order.sort((a, b) => sentiments.indexOf(result.logs[a].sentiment) - sentiments.indexOf(result.logs[b].sentiment));
  if (Array.isArray(raw.history)) result.history = raw.history.slice(-20).map(frame => {
    const clean = normalizeSnapshot({ statuses: frame.statuses, logs: frame.logs, order: frame.order, visits: frame.visits, version: 2, baseline: result.baseline }, ids);
    return { statuses: clean.statuses, logs: clean.logs, order: clean.order, visits: clean.visits };
  });
  return result;
}
function initialState(ids: Set<string>): FoodSnapshot {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return normalizeSnapshot(JSON.parse(saved), ids);
    const legacy = JSON.parse(localStorage.getItem('beli-dachitech:food-state:v1') || 'null');
    if (!legacy) return emptySnapshot();
    const migrated = emptySnapshot();
    migrated.statuses = legacy.statusOverrides || {};
    const scores = Object.entries(legacy.scores || {}).filter(([id, n]) => ids.has(id) && typeof n === 'number') as [string, number][];
    scores.sort((a, b) => b[1] - a[1]);
    for (const [id, score] of scores) {
      migrated.order.push(id);
      migrated.logs[id] = { sentiment: score >= 6.7 ? 'liked' : score >= 3.4 ? 'fine' : 'disliked', category: 'Restaurants', notes: '', tags: [], dishes: [], visitedAt: '', photoIds: [] };
    }
    return normalizeSnapshot(migrated, ids);
  } catch { return emptySnapshot(); }
}
export function statusFromSnapshot(state: FoodSnapshot, r: Restaurant): FoodStatus {
  return state.statuses[r.id] ?? (state.baseline === 'source' ? r.status : 'none');
}
export function rankedFromSnapshot(state: FoodSnapshot, restaurants: Restaurant[]): RankedRestaurant[] {
  const byId = new Map(restaurants.map(r => [r.id, r]));
  const ordered = state.order.filter(id => { const r = byId.get(id); return r && state.logs[id] && statusFromSnapshot(state, r) === 'been'; });
  return sentiments.flatMap(sentiment => {
    const bucket = ordered.filter(id => state.logs[id].sentiment === sentiment);
    const [low, high] = sentiment === 'liked' ? [6.7, 10] : sentiment === 'fine' ? [3.4, 6.6] : [0, 3.3];
    return bucket.map((id, index) => ({ restaurant: byId.get(id)!, sentiment,
      score: Math.round((low + (high - low) * (bucket.length - index) / (bucket.length + 1)) * 10) / 10,
      wins: 0, losses: 0, comparisons: 0 }));
  });
}
export function useFoodState(restaurants: Restaurant[]) {
  const ids = useMemo(() => new Set(restaurants.map(r => r.id)), [restaurants]);
  const byId = useMemo(() => new Map(restaurants.map(r => [r.id, r])), [restaurants]);
  const [snapshot, setSnapshot] = useState(() => initialState(ids));
  const [storageError, setStorageError] = useState('');
  const update = useCallback((fn: (s: FoodSnapshot) => FoodSnapshot) => setSnapshot(fn), []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(snapshot)); setStorageError(''); }
    catch { setStorageError('本机存储空间不足，请导出记录后清理空间。'); }
  }, [snapshot]);
  const getStatus = useCallback((id: string): FoodStatus => {
    const r = byId.get(id); return r ? statusFromSnapshot(snapshot, r) : 'none';
  }, [snapshot, byId]);
  const setStatus = useCallback((id: string, status: FoodStatus) => {
    if (ids.has(id)) update(s => ({ ...s, statuses: { ...s.statuses, [id]: status } }));
  }, [ids, update]);
  const ranked = useMemo(() => rankedFromSnapshot(snapshot, restaurants), [snapshot, restaurants]);
  const getScore = useCallback((id: string): number | null => ranked.find(r => r.restaurant.id === id)?.score ?? null, [ranked]);
  const getLog = useCallback((id: string): VisitLog | null => snapshot.logs[id] ?? null, [snapshot.logs]);
  const completeRanking = useCallback((id: string, log: VisitLog, position: number, addVisit = true) => {
    if (!ids.has(id)) return;
    const visit: VisitEntry = { ...log, id: crypto.randomUUID(), recordedAt: new Date().toISOString() };
    update(s => {
      const previous: FoodFrame = { statuses: s.statuses, logs: s.logs, order: s.order, visits: s.visits };
      const logs = { ...s.logs, [id]: log };
      const existing = s.order.filter(item => item !== id);
      const peers = existing.filter(item => logs[item]?.sentiment === log.sentiment);
      peers.splice(Math.max(0, Math.min(peers.length, position)), 0, id);
      const order = sentiments.flatMap(sentiment => sentiment === log.sentiment ? peers : existing.filter(item => logs[item]?.sentiment === sentiment));
      const visits = addVisit ? { ...s.visits, [id]: [...(s.visits[id] || []), visit] } : s.visits;
      return { ...s, logs, order, visits, statuses: { ...s.statuses, [id]: 'been' }, history: [...s.history, previous].slice(-20) };
    });
  }, [ids, update]);
  const saveVisit = useCallback((id: string, log: VisitLog) => {
    if (!ids.has(id)) return;
    const visit: VisitEntry = { ...log, id: crypto.randomUUID(), recordedAt: new Date().toISOString() };
    update(s => ({ ...s, statuses: { ...s.statuses, [id]: 'been' },
      visits: { ...s.visits, [id]: [...(s.visits[id] || []), visit] },
      history: [...s.history, { statuses: s.statuses, logs: s.logs, order: s.order, visits: s.visits }].slice(-20) }));
  }, [ids, update]);
  const undoComparison = useCallback(() => update(s => {
    const frame = s.history.at(-1); return frame ? { ...s, ...frame, history: s.history.slice(0, -1) } : s;
  }), [update]);
  const restore = useCallback((value: unknown) => update(() => normalizeSnapshot(value, ids)), [ids, update]);
  const reset = useCallback(() => update(s => emptySnapshot(s.baseline)), [update]);
  return { snapshot, getStatus, setStatus, getScore, getLog, completeRanking, saveVisit, undoComparison, ranked,
    comparisonHistory: snapshot.history, reset, restore, storageError };
}
export type FoodStateController = ReturnType<typeof useFoodState>;
