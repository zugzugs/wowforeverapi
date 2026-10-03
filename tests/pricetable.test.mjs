import test from "node:test";
import assert from "node:assert/strict";
import { parsePriceTable, changePercent } from "../src/lib/pricetable.mjs";
const market = "forever.pvp.horde.us";
const header = "AHL1|forever/pvp/horde/us|1791032093|";
test("parses a complete upstream snapshot without turning missing prices into zero", () => {
  const data = parsePriceTable(
    `${header}2\r\n2589:40:30:19443:92:90:15:112\r\n2592::0:12::::\r\n`,
    market,
  );
  assert.equal(data.items[0].quantity, 19443);
  assert.equal(data.items[1].median, null);
  assert.equal(data.items[1].minBuyout, 0);
  assert.equal(data.items[1].median7d, null);
  assert.equal(data.observedAt, "2026-10-03T12:54:53.000Z");
});
test("empty markets are valid", () => {
  assert.deepEqual(parsePriceTable("AHL1|forever/pvp/horde/us|0|0", market), {
    market,
    observedAt: null,
    items: [],
  });
});
test("rejects truncated, mismatched, duplicate and malformed upstream data", () => {
  for (const text of [
    `${header}2\n2589:40:30:1:40:40:1:50`,
    `${header}1\n2589:40:-3:1:40:40:1:50`,
    `${header}2\n2589:40:30:1:40:40:1:50\n2589:40:30:1:40:40:1:50`,
    "<html>Bad gateway</html>",
    `${header}1\n2589:NaN:30:1:40:40:1:50`,
  ])
    assert.throws(() => parsePriceTable(text, market));
  assert.throws(() => parsePriceTable(`${header}0`, "forever.normal.horde.us"));
});
test("baseline comparisons preserve unknown and zero baselines", () => {
  assert.equal(changePercent(50, 100), -50);
  assert.equal(changePercent(0, 100), -100);
  assert.equal(changePercent(null, 100), null);
  assert.equal(changePercent(100, 0), null);
});
