import { ITEMS } from '../sim/data';
import type { ItemDef } from '../sim/types';
import type { MarketListingView } from '../world_api';

export const MARKET_ITEM_TYPE_FILTERS = ['all', 'weapon', 'armor', 'consumable', 'material', 'other'] as const;
export const MARKET_RARITY_FILTERS = ['all', 'poor', 'common', 'uncommon', 'rare', 'epic'] as const;

export type MarketItemTypeFilter = typeof MARKET_ITEM_TYPE_FILTERS[number];
export type MarketRarityFilter = typeof MARKET_RARITY_FILTERS[number];

export interface MarketFilters {
  itemType: MarketItemTypeFilter;
  rarity: MarketRarityFilter;
}

function itemMatchesType(item: ItemDef, filter: MarketItemTypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'weapon') return item.kind === 'weapon' && item.slot === 'mainhand';
  if (filter === 'armor') return item.kind === 'armor' && item.slot !== undefined;
  if (filter === 'consumable') return item.kind === 'food' || item.kind === 'drink' || item.kind === 'potion' || item.kind === 'elixir';
  if (filter === 'material') return item.kind === 'junk' || item.kind === 'tool';
  return item.kind === 'quest';
}

function itemMatchesRarity(item: ItemDef, filter: MarketRarityFilter): boolean {
  if (filter === 'all') return true;
  return (item.quality ?? 'common') === filter;
}

export function filterMarketListings(listings: readonly MarketListingView[], filters: MarketFilters): MarketListingView[] {
  return listings.filter((listing) => {
    const item = ITEMS[listing.itemId];
    if (!item) return false;
    return itemMatchesType(item, filters.itemType) && itemMatchesRarity(item, filters.rarity);
  });
}
