# Forever Exchange

A responsive WoW Forever auction dashboard, powered by [AHledger](https://ahledger.com) player scans. Built with React, TypeScript, Vite, and Recharts; deploys as a static site on GitHub Pages.

**Website:** https://zugzugs.github.io/wowforeverapi/

## Features

- All available Forever markets, including honest empty states for unscanned markets.
- Search by item name or ID, category filters, sortable prices and quantities, and pagination.
- Lowest buyout, median, seven-day comparisons, and items below their seven-day baseline.
- Item details and on-demand 24-hour, 7-day, 30-day, and 90-day price charts.
- Hourly saved snapshots plus a manual browser refresh; scan time and stale-data warnings.
- Responsive keyboard-accessible UI, mobile layout, reduced-motion support, and visible attribution.

## Run locally

Requires Node.js 22+ and npm. No credentials or API key needed.

```sh
npm ci
npm run fetch:data
npm run dev
```

`fetch:data` requests all Forever price tables, then resolves item names/icons in batches of up to 100 using the documented tooltip endpoint. Requests are sequential and spaced 350 ms apart. It retries HTTP 429/5xx responses (up to three attempts) and respects Retry-After up to a 120-second wait per retry. A subsequent rate-limit response fails the run rather than publishing partial data. Snapshots are generated under `public/data/` and are ignored by Git.

```sh
npm test
npm run build
npm run preview
```

Browser tests use deterministic mocked API data, with no live API dependency:

```sh
npx playwright install chromium
npm run test:e2e
# Or use an installed Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

## GitHub Pages

1. Create a repository and push this source to its `main` branch.
2. Under **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Run **Refresh data and deploy Pages** from the Actions tab (or push to `main`).

The workflow installs dependencies, runs parser tests, fetches fresh data, builds the site, and deploys the `dist` artifact. It also runs hourly at minute 17 and supports manual dispatch. It needs only the standard GitHub Actions token with Pages/ID-token permissions in the deployment job; no AHledger secret is required. A failed fetch or build leaves the previous deployed site intact. GitHub may delay scheduled jobs, and scheduled workflows in inactive public repositories can be disabled after 60 days.

Vite uses a relative base (`./`), so assets and saved data work at both a project URL (`/<repository>/`) and a custom domain. Market selection uses a query parameter, without server-side routing. If forking, update the website and source-code links in this README and `src/App.tsx`.

## Data flow

```text
AHledger player scans → AHledger public API
                              ├─ GitHub Actions (hourly) → static snapshots → market table
                              └─ visitor browser → manual refresh + item history
```

Endpoints used:

| Endpoint                                | Purpose                                |
| --------------------------------------- | -------------------------------------- |
| `/v1/markets`                           | Discover Forever markets               |
| `/v1/pricetable/{market}`               | Bulk AHL1 price snapshot               |
| `/v1/tooltip/{market}?items=…`          | Batch item names, icons and categories |
| `/v1/prices/{market}/{itemId}?range=7d` | On-demand history                      |

The browser queues requests, deduplicates in-flight calls, honors exposed `Cache-Control: max-age` with a minimum 60-second cache, and backs off after rate limiting. Direct calls depend on AHledger's CORS policy. If those calls fail, the saved table remains usable and the history panel explains the failure. Metadata for newly appearing items is fetched on manual refresh. There is no polling loop in the browser.

`observedAt` is the upstream scan timestamp; `fetchedAt` is when the build downloaded the data. They are deliberately shown separately. Prices are copper per unit (10,000 copper = 1 gold). Missing values remain `null`. Change compares current median with seven-day median; “Below average” compares minimum buyout with seven-day median. A missing or zero baseline has no calculated percentage. Auction listings and scan differences do not prove completed sales. Beta data and API behavior may change or reset.

## Attribution and licensing

Auction pricing and item metadata are provided by **[AHledger](https://ahledger.com)** under its [API terms](https://ahledger.com/developers) and [terms of service](https://ahledger.com/terms). Keep the visible credit and link wherever the data is displayed. Do not claim scans as your own or resell them as a feed. This is a dashboard, not a replacement data-feed service. Data files and third-party game assets are not covered by this repository's software license.

World of Warcraft and its item artwork belong to Blizzard Entertainment. This is an independent fan project, not affiliated with or endorsed by Blizzard or AHledger.

Original application code is MIT licensed. Google Fonts loads DM Sans and Manrope; system sans-serif fonts are used if unavailable.
