import type { Restaurant } from '../data/restaurants';
import { rankedFromSnapshot, statusFromSnapshot, type FoodSnapshot, type VisitEntry, type VisitLog } from './useFoodState';
import type { Member, SharedState } from './useSharing';

export interface FeedPost {
  id: string;
  author: Member;
  restaurant: Restaurant;
  kind: 'visit' | 'history' | 'status';
  log?: VisitLog;
  visit?: VisitEntry;
  sortDate: string;
  score: number | null;
}
// A read-only projection. Never merge the two snapshots or write to personal ranking state.
export function sharedFeed(members: Member[], states: SharedState[], ownId: string | null, own: FoodSnapshot, restaurants: Restaurant[]): FeedPost[] {
  const byId = new Map(restaurants.map(restaurant => [restaurant.id, restaurant]));
  return members.flatMap(author => {
    const state = author.user_id === ownId ? own : states.find(row => row.user_id === author.user_id)?.payload;
    if (!state) return [];
    const scores = new Map(rankedFromSnapshot(state, restaurants).map(row => [row.restaurant.id, row.score]));
    const visits: FeedPost[] = Object.entries(state.visits).flatMap(([id, entries]) => {
      const restaurant = byId.get(id); if (!restaurant) return [];
      return entries.map(visit => ({ id: `${author.user_id}:visit:${id}:${visit.id}`, author, restaurant, kind: 'visit', visit, sortDate: visit.visitedAt || visit.recordedAt, score: scores.get(id) ?? null }));
    });
    // Only the snapshot that owns the original history may publish its notes/photos.
    // Being marked Been in another person's list does not copy that history to them.
    const history: FeedPost[] = state.baseline === 'source' ? restaurants.filter(restaurant => restaurant.status === 'been').map(restaurant => ({ id: `${author.user_id}:history:${restaurant.id}`, author, restaurant, kind: 'history', sortDate: restaurant.visitedAt || '', score: scores.get(restaurant.id) ?? null })) : [];
    const historyIds=new Set(history.map(post=>post.restaurant.id));
    const marked:FeedPost[]=restaurants.filter(restaurant=>statusFromSnapshot(state,restaurant)==='been'&&!state.visits[restaurant.id]?.length&&!historyIds.has(restaurant.id)).map(restaurant=>({id:`${author.user_id}:status:${restaurant.id}`,author,restaurant,kind:'status',log:state.logs[restaurant.id],sortDate:state.logs[restaurant.id]?.visitedAt||'',score:scores.get(restaurant.id)??null}));
    return [...visits, ...history, ...marked];
  }).sort((a, b) => b.sortDate.localeCompare(a.sortDate) || (b.visit?.recordedAt || '').localeCompare(a.visit?.recordedAt || '') || a.id.localeCompare(b.id));
}
