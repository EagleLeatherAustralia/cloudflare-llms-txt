import { parseFeed, type Product } from "./feed-parser";

export type Catalogue = {
  products: Product[];
  bySku: Map<string, Product>;
  loadedAt: number;
};

const TTL_MS = 3_600_000;
let memo: Catalogue | null = null;

export async function getCatalogue(feedBase: string): Promise<Catalogue> {
  if (memo && Date.now() - memo.loadedAt < TTL_MS) return memo;
  const upstream = new URL("llms-full.txt", feedBase).toString();
  const res = await fetch(upstream, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  const text = await res.text();
  const products = parseFeed(text);
  if (products.length === 0 && text.length > 0) {
    throw new Error("feed parse returned 0 products from non-empty body");
  }
  memo = {
    products,
    bySku: new Map(products.map((p) => [p.sku.toLowerCase(), p])),
    loadedAt: Date.now(),
  };
  return memo;
}
