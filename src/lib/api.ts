const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
let queue: Promise<unknown> = Promise.resolve();
let blockedUntil = 0;

export function api<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now())
    return Promise.resolve(cached.value as T);
  if (pending.has(path)) return pending.get(path) as Promise<T>;
  const task = queue
    .catch(() => {})
    .then(async () => {
      if (Date.now() < blockedUntil)
        throw new Error("AHledger is busy. Please try again in a minute.");
      await new Promise((resolve) => setTimeout(resolve, 350));
      const response = await fetch(`https://api.ahledger.com${path}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        const delay =
          retry && /^\d+$/.test(retry)
            ? Number(retry) * 1000
            : retry
              ? Date.parse(retry) - Date.now()
              : 60_000;
        blockedUntil =
          Date.now() +
          Math.max(60_000, Number.isFinite(delay) ? delay : 60_000);
        throw new Error("AHledger is busy. Please try again in a minute.");
      }
      if (!response.ok)
        throw new Error(
          `AHledger returned HTTP ${response.status}. Please try again later.`,
        );
      const value = path.startsWith("/v1/pricetable/")
        ? await response.text()
        : await response.json();
      const age = Number(
        response.headers
          .get("cache-control")
          ?.match(/(?:^|[,\s])max-age=(\d+)/)?.[1] ?? 60,
      );
      cache.set(path, {
        value,
        expires: Date.now() + Math.max(60, age) * 1000,
      });
      return value;
    });
  queue = task;
  pending.set(path, task);
  task.then(
    () => pending.delete(path),
    () => pending.delete(path),
  );
  return task as Promise<T>;
}

export async function localData<T>(name: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);
  if (!response.ok)
    throw new Error(
      "The saved market data is unavailable. Run npm run fetch:data before starting the site.",
    );
  return response.json();
}
