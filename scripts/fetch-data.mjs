import { mkdir, writeFile, rename } from "node:fs/promises";
import { parsePriceTable } from "../src/lib/pricetable.mjs";

const base = "https://api.ahledger.com";
const out = new URL("../public/data/", import.meta.url);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(out, { recursive: true });

async function request(path, plain = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Sequential requests at < 200/minute; do not send API keys to the browser.
    await sleep(350);
    const response = await fetch(base + path, {
      signal: AbortSignal.timeout(30_000),
      headers: { Accept: plain ? "text/plain" : "application/json" },
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const retry = response.headers.get("retry-after");
      const seconds =
        retry && /^\d+$/.test(retry)
          ? Number(retry)
          : retry
            ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
            : 5;
      await sleep(Math.min(120, Number.isFinite(seconds) ? seconds : 5) * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return plain ? response.text() : response.json();
  }
}

async function save(name, value) {
  const target = new URL(name, out);
  await writeFile(new URL(name + ".tmp", out), JSON.stringify(value));
  await rename(new URL(name + ".tmp", out), target);
}

const response = await request("/v1/markets");
const markets = response.markets.filter(
  (m) => m.game === "forever" && /^forever\.[a-z]+\.[a-z]+\.[a-z]+$/.test(m.id),
);
if (!markets.length)
  throw new Error(
    "No Forever markets returned; refusing to publish empty data.",
  );
const metadata = {};
const snapshots = [];
for (const market of markets) {
  const snapshot = parsePriceTable(
    await request(`/v1/pricetable/${market.id}`, true),
    market.id,
  );
  snapshots.push(snapshot);
  const missing = snapshot.items
    .map((item) => item.id)
    .filter((id) => !metadata[id]);
  for (let start = 0; start < missing.length; start += 100) {
    const data = await request(
      `/v1/tooltip/${market.id}?items=${missing.slice(start, start + 100).join(",")}`,
    );
    if (!Array.isArray(data.items))
      throw new Error("Invalid item metadata response");
    for (const { id, name, quality, icon, level, itemClass } of data.items)
      metadata[id] = { id, name, quality, icon, level, itemClass };
  }
  console.log(
    `${market.label}: ${snapshot.items.length} items, scanned ${snapshot.observedAt ?? "never"}`,
  );
}
if (!snapshots.some((s) => s.items.length))
  throw new Error(
    "All markets are empty; previous deployment will be retained.",
  );
for (const snapshot of snapshots)
  await save(`${snapshot.market}.json`, snapshot);
await save("items.json", metadata);
await save("markets.json", {
  markets,
  fetchedAt: new Date().toISOString(),
  source: "https://ahledger.com",
});
console.log(
  `Saved ${Object.keys(metadata).length} named items across ${markets.length} markets.`,
);
