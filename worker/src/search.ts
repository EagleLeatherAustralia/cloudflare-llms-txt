import type { Product } from "./feed-parser";

export type SearchOpts = {
  query: string;
  category?: string;
  brand?: string;
  inStockOnly?: boolean;
  limit?: number;
};

export function priceLabel(p: Product): string {
  const pr = p.price;
  if (pr.maxAmount) return `A$${pr.amount.toFixed(2)}–A$${pr.maxAmount.toFixed(2)}`;
  if (pr.was) return `A$${pr.amount.toFixed(2)} (was A$${pr.was.toFixed(2)})`;
  return `A$${pr.amount.toFixed(2)}`;
}

export function matchesCategory(p: Product, query: string): boolean {
  const q = query.toLowerCase();
  return p.categories.some((bc) => bc.some((c) => c.toLowerCase().includes(q)));
}

export function scoreProduct(p: Product, q: string): number {
  return (
    (p.sku.toLowerCase() === q ? 100 : 0) +
    (p.name.toLowerCase() === q ? 50 : 0) +
    (p.name.toLowerCase().includes(q) ? 10 : 0) +
    (p.brand?.toLowerCase().includes(q) ? 3 : 0) +
    (p.description.toLowerCase().includes(q) ? 1 : 0)
  );
}

export function searchProducts(products: Product[], opts: SearchOpts): Product[] {
  const q = opts.query.toLowerCase();
  return products
    .filter((p) => !opts.brand || p.brand?.toLowerCase() === opts.brand.toLowerCase())
    .filter((p) => !opts.category || matchesCategory(p, opts.category))
    .filter((p) => !opts.inStockOnly || p.inStock)
    .map((p) => ({ p, score: scoreProduct(p, q) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 10)
    .map((m) => m.p);
}

export function brandCounts(products: Product[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    if (!p.brand) continue;
    counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  }
  return counts;
}

export function uniqueCategories(products: Product[]): string[] {
  const seen = new Set<string>();
  for (const p of products) for (const bc of p.categories) seen.add(bc.join(" › "));
  return [...seen].sort();
}
