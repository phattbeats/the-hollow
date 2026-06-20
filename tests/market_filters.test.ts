import { describe, expect, it } from 'vitest';
import type { MarketListingView } from '../src/world_api';
import {
  MARKET_ITEM_TYPE_FILTERS,
  MARKET_RARITY_FILTERS,
  filterMarketListings,
} from '../src/ui/market_filters';

function listing(itemId: string): MarketListingView {
  return {
    id: itemId.length,
    sellerName: 'Seller',
    itemId,
    count: 1,
    price: 100,
    mine: false,
    house: false,
  };
}

describe('World Market filters', () => {
  const listings = [
    listing('wolf_fang'),
    listing('bone_fragments'),
    listing('keen_dirk'),
    listing('greyjaw_pelt_cloak'),
    listing('roasted_boar'),
    listing('minor_healing_potion'),
    listing('elixir_of_the_bear'),
  ];

  it('exposes stable item type and rarity filter options for the browse UI', () => {
    expect(MARKET_ITEM_TYPE_FILTERS).toEqual(['all', 'weapon', 'armor', 'consumable', 'material', 'other']);
    expect(MARKET_RARITY_FILTERS).toEqual(['all', 'poor', 'common', 'uncommon', 'rare', 'epic']);
  });

  it('groups wearable armor separately from weapons and consumables', () => {
    expect(filterMarketListings(listings, { itemType: 'armor', rarity: 'all' }).map((l) => l.itemId))
      .toEqual(['greyjaw_pelt_cloak']);
    expect(filterMarketListings(listings, { itemType: 'weapon', rarity: 'all' }).map((l) => l.itemId))
      .toEqual(['keen_dirk']);
    expect(filterMarketListings(listings, { itemType: 'consumable', rarity: 'all' }).map((l) => l.itemId))
      .toEqual(['roasted_boar', 'minor_healing_potion', 'elixir_of_the_bear']);
  });

  it('matches rarities by the game quality names', () => {
    expect(filterMarketListings(listings, { itemType: 'all', rarity: 'poor' }).map((l) => l.itemId))
      .toEqual(['wolf_fang', 'bone_fragments']);
    expect(filterMarketListings(listings, { itemType: 'all', rarity: 'common' }).map((l) => l.itemId))
      .toEqual(['roasted_boar', 'minor_healing_potion']);
    expect(filterMarketListings(listings, { itemType: 'all', rarity: 'uncommon' }).map((l) => l.itemId))
      .toEqual(['keen_dirk', 'greyjaw_pelt_cloak', 'elixir_of_the_bear']);
  });

  it('combines item type and rarity filters', () => {
    expect(filterMarketListings(listings, { itemType: 'armor', rarity: 'uncommon' }).map((l) => l.itemId))
      .toEqual(['greyjaw_pelt_cloak']);
    expect(filterMarketListings(listings, { itemType: 'armor', rarity: 'common' })).toEqual([]);
  });
});
