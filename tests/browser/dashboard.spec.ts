import { expect, test } from "@playwright/test";
const market = "forever.pvp.horde.us";
const empty = "forever.rp.horde.us";
const items = {
  "2589": {
    id: 2589,
    name: "Linen Cloth",
    quality: "COMMON",
    itemClass: "Trade Goods",
  },
  "2592": {
    id: 2592,
    name: "Wool Cloth",
    quality: "COMMON",
    itemClass: "Trade Goods",
  },
};
test.beforeEach(async ({ page }) => {
  await page.route("**/data/*.json", async (route) => {
    const url = route.request().url();
    const body = url.endsWith("/markets.json")
      ? {
          fetchedAt: new Date().toISOString(),
          markets: [
            {
              id: market,
              game: "forever",
              label: "PvP Horde",
              faction: "horde",
              region: "us",
              ruleset: "pvp",
            },
            {
              id: empty,
              game: "forever",
              label: "RP Horde",
              faction: "horde",
              region: "us",
              ruleset: "rp",
            },
          ],
        }
      : url.endsWith("/items.json")
        ? items
        : {
            market: url.includes(empty) ? empty : market,
            observedAt: new Date().toISOString(),
            items: url.includes(empty)
              ? []
              : [
                  {
                    id: 2589,
                    median: 90,
                    minBuyout: 37,
                    quantity: 1000,
                    median7d: 100,
                    median30d: 100,
                    low30d: 20,
                    high30d: 130,
                  },
                  {
                    id: 2592,
                    median: 150,
                    minBuyout: 120,
                    quantity: 200,
                    median7d: 100,
                    median30d: 100,
                    low30d: 50,
                    high30d: 200,
                  },
                ],
          };
    await route.fulfill({ json: body });
  });
  await page.route("https://api.ahledger.com/**", (route) =>
    route.fulfill({
      json: {
        market,
        latest: null,
        series: [
          { t: "2026-10-01T00:00:00Z", min: 30, median: 100, quantity: 100 },
          { t: "2026-10-02T00:00:00Z", min: 37, median: 90, quantity: 120 },
        ],
      },
    }),
  );
});
test("search, sorting, filters, selection and empty markets", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Linen Cloth Trade Goods" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search items" }).fill("wool");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Wool Cloth Trade Goods" }).click();
  await expect(page.getByRole("heading", { name: "Wool Cloth" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "Below average" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Linen Cloth");
  await page.getByRole("button", { name: "All items" }).click();
  await page
    .getByRole("button", { name: "Lowest buyout", exact: true })
    .click();
  await expect(page.locator("tbody tr").first()).toContainText("Wool Cloth");
  await page.getByLabel("YOUR MARKET").selectOption(empty);
  await expect(
    page.getByRole("heading", { name: "No scans for this market yet" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/market=forever.rp.horde.us/);
});
test("keeps saved prices and explains live API failure", async ({ page }) => {
  await page.route("**/v1/pricetable/**", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Refresh prices" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Displaying the last available snapshot",
  );
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
test("mobile layout fits viewport and history is usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Linen Cloth Trade Goods" }).click();
  await expect(
    page.getByRole("heading", { name: "Linen Cloth" }),
  ).toBeVisible();
  await expect(page.locator(".chart svg").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close item details" }).click();
  await expect(
    page.getByRole("heading", { name: "Market overview" }),
  ).toBeVisible();
});
