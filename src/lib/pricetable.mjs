/** Parse AHledger's documented AHL1 format. Unknown prices stay null, never zero. */
export function parsePriceTable(text, expectedMarket) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const [format, market, timestamp, count] = header.split("|");
  if (
    format !== "AHL1" ||
    market?.replaceAll("/", ".") !== expectedMarket ||
    !/^\d+$/.test(timestamp) ||
    !/^\d+$/.test(count)
  ) {
    throw new Error("Unrecognized AHledger price table");
  }
  const observedAt =
    Number(timestamp) === 0
      ? null
      : new Date(Number(timestamp) * 1000).toISOString();
  const ids = new Set();
  const items = lines.filter(Boolean).map((line) => {
    const fields = line.split(":");
    if (fields.length !== 8 || fields.some((v) => v !== "" && !/^\d+$/.test(v)))
      throw new Error("Malformed auction row");
    const [
      id,
      median,
      minBuyout,
      quantity,
      median7d,
      median30d,
      low30d,
      high30d,
    ] = fields.map((v) => (v === "" ? null : Number(v)));
    if (
      !id ||
      ids.has(id) ||
      fields.some((v) => v && !Number.isSafeInteger(Number(v)))
    )
      throw new Error("Invalid item identifier or price");
    ids.add(id);
    return {
      id,
      median,
      minBuyout,
      quantity,
      median7d,
      median30d,
      low30d,
      high30d,
    };
  });
  if (items.length !== Number(count))
    throw new Error("Incomplete auction snapshot");
  return { market: expectedMarket, observedAt, items };
}

export function changePercent(current, baseline) {
  return current == null || baseline == null || baseline <= 0
    ? null
    : ((current - baseline) / baseline) * 100;
}
