export type Market = {
  id: string;
  game: string;
  ruleset: string;
  faction: string;
  region: string;
  label: string;
};
export type Price = {
  id: number;
  median: number | null;
  minBuyout: number | null;
  quantity: number | null;
  median7d: number | null;
  median30d: number | null;
  low30d: number | null;
  high30d: number | null;
};
export type Item = {
  id: number;
  name: string;
  quality: string;
  icon?: string;
  level?: number;
  itemClass?: string;
};
export type Snapshot = {
  market: string;
  observedAt: string | null;
  items: Price[];
};
export type History = {
  market: string;
  latest: {
    observedAt: string;
    minBuyout: number;
    median: number;
    quantity: number;
  } | null;
  series: { t: string; min: number; median: number; quantity: number }[];
};
