import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  Gem,
  RefreshCw,
  Search,
  Shield,
  Swords,
  TrendingDown,
  X,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, localData } from "./lib/api";
import { changePercent, parsePriceTable } from "./lib/pricetable.mjs";
import type { History, Item, Market, Price, Snapshot } from "./types";

const nf = new Intl.NumberFormat("en-US");
const moneyText = (n: number) =>
  n >= 10000
    ? `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 })}g`
    : n >= 100
      ? `${(n / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}s`
      : `${n}c`;
function Money({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="muted">—</span>;
  const gold = Math.floor(value / 10000),
    silver = Math.floor((value % 10000) / 100),
    copper = Math.floor(value % 100);
  return (
    <span
      className="money"
      aria-label={`${gold} gold, ${silver} silver, ${copper} copper`}
    >
      {gold > 0 && (
        <span>
          {nf.format(gold)}
          <i className="gold">g</i>
        </span>
      )}
      {(silver > 0 || gold > 0) && (
        <span>
          {silver}
          <i className="silver">s</i>
        </span>
      )}
      <span>
        {copper}
        <i className="copper">c</i>
      </span>
    </span>
  );
}
function Change({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">—</span>;
  return (
    <span className={`change ${value < 0 ? "down" : value > 0 ? "up" : ""}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}
function age(iso: string | null) {
  if (!iso) return "No scans yet";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(iso)) / 60000),
  );
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
}
function Icon({ item, large = false }: { item?: Item; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item?.icon]);
  const safeIcon = item?.icon?.startsWith("https://") ? item.icon : undefined;
  return (
    <span
      className={`item-icon ${large ? "large" : ""} quality-${item?.quality?.toLowerCase() ?? "common"}`}
    >
      {safeIcon && !failed ? (
        <img
          src={safeIcon}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Gem size={large ? 26 : 18} />
      )}
    </span>
  );
}

function ItemDetail({
  item,
  price,
  market,
  onClose,
}: {
  item: Item;
  price: Price;
  market: Market;
  onClose: () => void;
}) {
  const [range, setRange] = useState("7d");
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setHistory(null);
    api<History>(`/v1/prices/${market.id}/${item.id}?range=${range}`)
      .then((data) => {
        if (!Array.isArray(data.series))
          throw new Error("Price history is unavailable.");
        if (active) setHistory(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [market.id, item.id, range, retry]);
  const points = (history?.series ?? [])
    .filter((p) => Number.isFinite(Date.parse(p.t)))
    .map((p) => ({ ...p, time: Date.parse(p.t) }))
    .sort((a, b) => a.time - b.time);
  return (
    <aside className="detail panel" aria-label={`${item.name} details`}>
      <div className="detail-top">
        <span className="eyebrow">ITEM INSIGHT</span>
        <button
          className="icon-button close-detail"
          aria-label="Close item details"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="detail-title">
        <Icon item={item} large />
        <div>
          <h2>{item.name}</h2>
          <p>
            {item.itemClass ?? "Item"} <span>·</span> #{item.id}
          </p>
        </div>
      </div>
      <div className="detail-price">
        <span className="muted">Lowest buyout / unit</span>
        <div>
          <Money value={price.minBuyout} />
        </div>
      </div>
      <div className="detail-stats">
        <div>
          <span>Market median</span>
          <Money value={price.median} />
        </div>
        <div>
          <span>Units listed</span>
          <strong>
            {price.quantity == null ? "—" : nf.format(price.quantity)}
          </strong>
        </div>
      </div>
      <div className="chart-heading">
        <h3>Price history</h3>
        <div className="range" aria-label="History range">
          {["24h", "7d", "30d", "90d"].map((r) => (
            <button
              key={r}
              aria-pressed={range === r}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="chart" aria-live="polite">
        {loading ? (
          <div className="chart-message">
            <RefreshCw className="spin" size={20} />
            Loading price history…
          </div>
        ) : error ? (
          <div className="chart-message">
            <span>{error}</span>
            <button
              className="text-button"
              onClick={() => setRetry((n) => n + 1)}
            >
              Retry history
            </button>
          </div>
        ) : !points.length ? (
          <div className="chart-message">No price history for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={points}
              margin={{ top: 12, right: 6, bottom: 0, left: -24 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9b66d" stopOpacity={0.23} />
                  <stop offset="100%" stopColor="#d9b66d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#28312d"
                vertical={false}
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) =>
                  new Date(t).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }
                tick={{ fill: "#95a39b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={35}
              />
              <YAxis
                tickFormatter={moneyText}
                tick={{ fill: "#95a39b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip
                contentStyle={{
                  background: "#1c2520",
                  border: "1px solid #4d5a50",
                  borderRadius: 8,
                  fontSize: 13,
                }}
                labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
                formatter={(value, name) => [
                  moneyText(Number(value)),
                  name === "median" ? "Median" : "Lowest buyout",
                ]}
              />
              <Area
                type="linear"
                dataKey="median"
                stroke="#d9b66d"
                strokeWidth={2}
                fill="url(#priceFill)"
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="min"
                stroke="#70bca0"
                strokeWidth={1.5}
                dot={points.length === 1}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-gold" />
          Median
        </span>
        <span>
          <i className="legend-green" />
          Lowest buyout
        </span>
      </div>
      {history?.latest && (
        <p className="history-age">
          History’s latest observation:{" "}
          {new Date(history.latest.observedAt).toLocaleString()}
        </p>
      )}
      <div className="period-stats">
        <div>
          <span>7-day median</span>
          <Money value={price.median7d} />
        </div>
        <div>
          <span>30-day median</span>
          <Money value={price.median30d} />
        </div>
        <div>
          <span>30-day low</span>
          <Money value={price.low30d} />
        </div>
        <div>
          <span>30-day high</span>
          <Money value={price.high30d} />
        </div>
      </div>
      <div className="insight-note">
        <CircleHelp size={17} />
        <p>
          Prices reflect player scans on <strong>{market.label}</strong>. Listed
          prices are not confirmed sales.
        </p>
      </div>
      <a
        className="source-link"
        href={`https://ahledger.com/items/${item.id}`}
        target="_blank"
        rel="noreferrer"
      >
        View item on AHledger <ExternalLink size={14} />
      </a>
    </aside>
  );
}

type SortKey = "name" | "minBuyout" | "median" | "quantity" | "change";
export default function App() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [metadata, setMetadata] = useState<Record<string, Item>>({});
  const [marketId, setMarketId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [mode, setMode] = useState("all");
  const [sort, setSort] = useState<SortKey>("quantity");
  const [direction, setDirection] = useState(-1);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(() =>
    window.matchMedia("(max-width: 950px)").matches ? null : 2589,
  );
  const [reload, setReload] = useState(0);
  const [fetchedAt, setFetchedAt] = useState("");
  const [live, setLive] = useState(false);
  const requestId = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (selected != null && window.matchMedia("(max-width: 950px)").matches) {
      document
        .querySelector(".detail")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [selected]);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      localData<{ markets: Market[]; fetchedAt: string }>("markets"),
      localData<Record<string, Item>>("items"),
    ])
      .then(([data, items]) => {
        if (!active) return;
        setMarkets(data.markets);
        setMetadata(items);
        setFetchedAt(data.fetchedAt);
        const fromUrl = new URLSearchParams(location.search).get("market");
        setMarketId(
          data.markets.find((m) => m.id === fromUrl)?.id ??
            data.markets.find((m) => m.id === "forever.pvp.horde.us")?.id ??
            data.markets[0]?.id ??
            "",
        );
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    if (!marketId) return;
    const id = ++requestId.current;
    setLoading(true);
    setRefreshing(false);
    setSnapshot(null);
    setError("");
    setNotice("");
    setLive(false);
    setPage(0);
    localData<Snapshot>(marketId)
      .then((data) => {
        if (requestId.current === id) {
          setSnapshot(data);
          setSelected((previous) =>
            previous === null
              ? null
              : data.items.some((p) => p.id === previous)
                ? previous
                : (data.items.find((p) => p.id === 2589)?.id ??
                  data.items[0]?.id ??
                  null),
          );
        }
      })
      .catch((e) => {
        if (requestId.current === id) setError(e.message);
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
    const url = new URL(location.href);
    url.searchParams.set("market", marketId);
    window.history.replaceState(null, "", url);
    return () => {
      requestId.current++;
    };
  }, [marketId, reload]);
  async function refresh() {
    const id = ++requestId.current;
    setRefreshing(true);
    setNotice("");
    try {
      const next = parsePriceTable(
        await api<string>(`/v1/pricetable/${marketId}`),
        marketId,
      ) as Snapshot;
      if (id !== requestId.current) return;
      setSnapshot(next);
      setLive(true);
      setError("");
      setPage(0);
      setSelected((previous) =>
        previous === null
          ? null
          : next.items.some((p) => p.id === previous)
            ? previous
            : (next.items[0]?.id ?? null),
      );
      const missing = next.items
        .map((p) => p.id)
        .filter((itemId) => !metadata[itemId]);
      for (let i = 0; i < missing.length; i += 100) {
        if (id !== requestId.current) return;
        const result = await api<{ items: Item[] }>(
          `/v1/tooltip/${marketId}?items=${missing.slice(i, i + 100).join(",")}`,
        );
        if (id === requestId.current)
          setMetadata((prev) => ({
            ...prev,
            ...Object.fromEntries(result.items.map((item) => [item.id, item])),
          }));
      }
    } catch (e) {
      if (id === requestId.current)
        setNotice(
          `${(e as Error).message} Displaying the last available snapshot.`,
        );
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }
  const market = markets.find((m) => m.id === marketId);
  const prices = snapshot?.items ?? [];
  const categories = useMemo(
    () =>
      [
        ...new Set(
          prices
            .map((p) => metadata[p.id]?.itemClass)
            .filter((c): c is string => !!c),
        ),
      ].sort(),
    [prices, metadata],
  );
  const filtered = useMemo(
    () =>
      prices
        .filter((p) => {
          const item = metadata[p.id];
          return (
            (!query ||
              `${item?.name ?? ""} ${p.id}`
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (category === "All categories" || item?.itemClass === category) &&
            (mode !== "below" ||
              (p.median7d != null &&
                p.minBuyout != null &&
                p.minBuyout < p.median7d))
          );
        })
        .sort((a, b) => {
          if (sort === "name")
            return (
              direction *
              (metadata[a.id]?.name ?? `Item ${a.id}`).localeCompare(
                metadata[b.id]?.name ?? `Item ${b.id}`,
              )
            );
          const av =
            sort === "change" ? changePercent(a.median, a.median7d) : a[sort];
          const bv =
            sort === "change" ? changePercent(b.median, b.median7d) : b[sort];
          return av == null
            ? bv == null
              ? a.id - b.id
              : 1
            : bv == null
              ? -1
              : direction * (av - bv) || a.id - b.id;
        }),
    [prices, metadata, query, category, mode, sort, direction],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const safePage = Math.min(page, pageCount - 1);
  const selectedPrice = prices.find((p) => p.id === selected);
  const selectedItem =
    selected == null
      ? undefined
      : (metadata[selected] ?? {
          id: selected,
          name: `Item #${selected}`,
          quality: "COMMON",
        });
  const below = prices.filter(
    (p) =>
      p.minBuyout != null && p.median7d != null && p.minBuyout < p.median7d,
  ).length;
  function changeSort(key: SortKey) {
    setDirection(sort === key ? -direction : key === "name" ? 1 : -1);
    setSort(key);
    setPage(0);
  }
  const stale =
    snapshot?.observedAt &&
    Date.now() - Date.parse(snapshot.observedAt) > 24 * 3600_000;
  const sortLabels: [SortKey, string][] = [
    ["name", "Item"],
    ["minBuyout", "Lowest buyout"],
    ["median", "Median"],
    ["change", "vs. 7d median"],
    ["quantity", "Quantity"],
  ];
  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark">
            F<span>✦</span>
          </span>
          <span>
            FOREVER <strong>EXCHANGE</strong>
          </span>
          <span className="beta">BETA</span>
        </div>
        <a
          href="https://github.com/zugzugs/wowforeverapi"
          target="_blank"
          rel="noreferrer"
        >
          Source code <ExternalLink size={14} />
        </a>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORLD OF WARCRAFT · FOREVER</div>
            <h1>
              The auction house, <em>at a glance.</em>
            </h1>
            <p>Find your next trade with prices from the player community.</p>
          </div>
          <div className="provider">
            <span>Market data by</span>
            <a href="https://ahledger.com" target="_blank" rel="noreferrer">
              AHledger <ExternalLink size={13} />
            </a>
          </div>
        </div>
        <section className="market-bar" aria-label="Market controls">
          <div className="market-label">
            <span className="market-emblem">
              {market?.faction === "alliance" ? (
                <Shield size={23} />
              ) : (
                <Swords size={23} />
              )}
            </span>
            <div>
              <label htmlFor="market">YOUR MARKET</label>
              <select
                id="market"
                value={marketId}
                onChange={(e) => {
                  setMarketId(e.target.value);
                  setCategory("All categories");
                }}
                disabled={!markets.length}
              >
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {m.region.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="scan-info">
            <span
              className={`scan-dot ${stale || !snapshot?.observedAt ? "old" : ""}`}
            />
            <div>
              <strong>
                {snapshot?.observedAt
                  ? `Scanned ${age(snapshot.observedAt)}`
                  : "Awaiting market scan"}
              </strong>
              <span>
                {live ? "Fetched from AHledger" : "Hourly saved snapshot"}
              </span>
            </div>
          </div>
          <button
            className="refresh-button"
            onClick={refresh}
            disabled={refreshing || !marketId || loading}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh prices"}
          </button>
        </section>
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {stale && (
          <div className="notice" role="status">
            This market’s latest scan is more than 24 hours old. Prices may have
            changed in game.
          </div>
        )}
        <div className="summary-grid">
          <div className="summary">
            <span>
              <BarChart3 size={16} />
              Items on the market
            </span>
            <strong>{loading ? "—" : nf.format(prices.length)}</strong>
            <small>Unique items with prices</small>
          </div>
          <div className="summary">
            <span>
              <Gem size={16} />
              Total units listed
            </span>
            <strong>
              {loading
                ? "—"
                : nf.format(
                    prices.reduce((sum, p) => sum + (p.quantity ?? 0), 0),
                  )}
            </strong>
            <small>Across the latest snapshot</small>
          </div>
          <div className="summary">
            <span>
              <TrendingDown size={16} />
              Below 7-day median
            </span>
            <strong className="green">
              {loading ? "—" : nf.format(below)}
            </strong>
            <small>Items with a lower buyout</small>
          </div>
        </div>
        <div
          className={`workspace ${selectedPrice && selectedItem ? "" : "no-detail"}`}
        >
          <section className="market-panel panel" aria-label="Auction prices">
            <div className="panel-heading">
              <h2>Market overview</h2>
              <span className="subtle-label">
                {market?.region.toUpperCase() ?? "US"} ·{" "}
                {market?.label ?? "Forever"}
              </span>
            </div>
            <div className="table-tabs">
              <button
                aria-pressed={mode === "all"}
                onClick={() => {
                  setMode("all");
                  setPage(0);
                }}
              >
                All items <span>{nf.format(prices.length)}</span>
              </button>
              <button
                aria-pressed={mode === "below"}
                onClick={() => {
                  setMode("below");
                  setPage(0);
                }}
              >
                Below average <span>{nf.format(below)}</span>
              </button>
            </div>
            <div className="filters">
              <div className="search">
                <Search size={18} />
                <input
                  ref={searchRef}
                  aria-label="Search items"
                  placeholder="Search items or item ID…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
                {query && (
                  <button
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      setPage(0);
                      searchRef.current?.focus();
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <select
                aria-label="Item category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(0);
                }}
              >
                <option>All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {loading ? (
              <div className="empty-state" role="status">
                <RefreshCw className="spin" size={25} />
                <h3>Opening the market…</h3>
                <p>Loading the latest saved auction snapshot.</p>
              </div>
            ) : error ? (
              <div className="empty-state" role="alert">
                <CircleHelp size={26} />
                <h3>Couldn’t load the market</h3>
                <p>{error}</p>
                <button
                  className="refresh-button"
                  onClick={() => setReload((n) => n + 1)}
                >
                  Try again
                </button>
              </div>
            ) : !prices.length ? (
              <div className="empty-state">
                <Swords size={30} />
                <h3>No scans for this market yet</h3>
                <p>
                  Prices will appear when AHledger contributors scan this
                  auction house. Try another market.
                </p>
              </div>
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {sortLabels.map(([key, label]) => (
                          <th
                            key={key}
                            aria-sort={
                              sort === key
                                ? direction === 1
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                          >
                            <button onClick={() => changeSort(key)}>
                              {label}
                              {sort === key ? (
                                direction === 1 ? (
                                  <ArrowUp size={12} />
                                ) : (
                                  <ArrowDown size={12} />
                                )
                              ) : (
                                <ArrowUpDown size={12} />
                              )}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered
                        .slice(safePage * 25, safePage * 25 + 25)
                        .map((p) => (
                          <tr
                            key={p.id}
                            className={selected === p.id ? "selected" : ""}
                          >
                            <td>
                              <button
                                className="item-button"
                                aria-pressed={selected === p.id}
                                onClick={() => setSelected(p.id)}
                              >
                                <Icon item={metadata[p.id]} />
                                <span>
                                  <strong
                                    className={`text-${metadata[p.id]?.quality?.toLowerCase()}`}
                                  >
                                    {metadata[p.id]?.name ?? `Item #${p.id}`}
                                  </strong>
                                  <small>
                                    {metadata[p.id]?.itemClass ??
                                      `Item #${p.id}`}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td>
                              <Money value={p.minBuyout} />
                            </td>
                            <td>
                              <Money value={p.median} />
                            </td>
                            <td>
                              <Change
                                value={changePercent(p.median, p.median7d)}
                              />
                            </td>
                            <td className="quantity">
                              {p.quantity == null ? "—" : nf.format(p.quantity)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <div className="empty-state">
                    <Search size={28} />
                    <h3>No matching items</h3>
                    <p>Try a different name, item ID, or category.</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setCategory("All categories");
                        setMode("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                <div className="pagination">
                  <span>
                    {filtered.length
                      ? `${safePage * 25 + 1}–${Math.min((safePage + 1) * 25, filtered.length)}`
                      : "0"}{" "}
                    of {nf.format(filtered.length)} items
                  </span>
                  <div>
                    <button
                      aria-label="Previous page"
                      disabled={safePage === 0}
                      onClick={() => setPage(safePage - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>
                      {safePage + 1} / {pageCount}
                    </span>
                    <button
                      aria-label="Next page"
                      disabled={safePage + 1 >= pageCount}
                      onClick={() => setPage(safePage + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          {selectedPrice && selectedItem && market && (
            <ItemDetail
              key={`${market.id}:${selectedItem.id}`}
              item={selectedItem}
              price={selectedPrice}
              market={market}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
        <div className="data-note">
          <CircleHelp size={16} />
          <p>
            <strong>A snapshot, not a live auction feed.</strong> All prices are
            per unit. “vs. 7d median” compares the current median with its
            seven-day baseline. “Below average” compares the lowest buyout with
            that baseline. Missing values appear as a dash.
          </p>
        </div>
      </main>
      <footer>
        <div>
          <span className="footer-brand">FOREVER EXCHANGE</span>
          <span>Built for the auction house regulars.</span>
        </div>
        <p>
          Player scan data from{" "}
          <a href="https://ahledger.com" target="_blank" rel="noreferrer">
            AHledger
          </a>{" "}
          ·{" "}
          <a
            href="https://ahledger.com/developers"
            target="_blank"
            rel="noreferrer"
          >
            Data & terms
          </a>
          {fetchedAt && (
            <span className="build-time">
              Snapshot fetched {new Date(fetchedAt).toLocaleString()}
            </span>
          )}
        </p>
        <span className="disclaimer">
          Independent fan project. Not affiliated with Blizzard Entertainment or
          AHledger.
        </span>
      </footer>
    </>
  );
}
