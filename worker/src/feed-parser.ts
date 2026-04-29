export type Price = {
  amount: number;
  currency: "AUD";
  was?: number;
  maxAmount?: number;
  raw: string;
};

export type Product = {
  sku: string;
  gtin?: string;
  name: string;
  url: string;
  brand?: string;
  price: Price;
  inStock: boolean;
  categories: string[][];
  color?: string;
  size?: string;
  material?: string;
  imageUrl?: string;
  description: string;
  extra: Record<string, string>;
};

const PRICE_RE = /A\$([0-9]+(?:\.[0-9]+)?)(?:[–-]A\$([0-9]+(?:\.[0-9]+)?))?(?:\s*\(was\s+A\$([0-9]+(?:\.[0-9]+)?)\))?/;

function parsePrice(raw: string): Price {
  const m = PRICE_RE.exec(raw);
  if (!m) return { amount: 0, currency: "AUD", raw };
  const amount = parseFloat(m[1]);
  const maxAmount = m[2] ? parseFloat(m[2]) : undefined;
  const was = m[3] ? parseFloat(m[3]) : undefined;
  return { amount, currency: "AUD", maxAmount, was, raw };
}

function parseSection(section: string): Product | null {
  const lines = section.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].startsWith("## ")) i++;
  if (i >= lines.length) return null;

  const name = lines[i].slice(3).trim();
  i++;

  while (i < lines.length && lines[i].trim() === "") i++;

  const meta: Record<string, string> = {};
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("- ")) {
      const m = /^-\s+([A-Za-z][A-Za-z ]*?):\s*(.+)$/.exec(line);
      if (m) meta[m[1].trim()] = m[2].trim();
      i++;
    } else if (line.trim() === "") {
      i++;
      break;
    } else {
      break;
    }
  }

  const description = lines.slice(i).join("\n").trim();

  const sku = meta["SKU"];
  const url = meta["URL"];
  const stock = meta["Stock"];
  const priceRaw = meta["Price"];
  if (!sku || !url || !stock || !priceRaw) return null;

  const known = new Set(["SKU", "GTIN", "URL", "Brand", "Price", "Stock", "Categories", "Color", "Size", "Material", "Image"]);
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!known.has(k)) extra[k] = v;
  }

  return {
    sku,
    gtin: meta["GTIN"],
    name,
    url,
    brand: meta["Brand"],
    price: parsePrice(priceRaw),
    inStock: /in stock/i.test(stock) && !/out of stock/i.test(stock),
    categories: (meta["Categories"] ?? "")
      .split(";")
      .map((bc) => bc.split(",").map((s) => s.trim()).filter(Boolean))
      .filter((bc) => bc.length > 0),
    color: meta["Color"],
    size: meta["Size"],
    material: meta["Material"],
    imageUrl: meta["Image"],
    description,
    extra,
  };
}

export function parseFeed(text: string): Product[] {
  const products: Product[] = [];
  const lines = text.split("\n");
  let buf: string[] = [];
  for (const line of lines) {
    if (line.trim() === "---") {
      if (buf.some((l) => l.startsWith("## "))) {
        const p = parseSection(buf.join("\n"));
        if (p) products.push(p);
      }
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.some((l) => l.startsWith("## "))) {
    const p = parseSection(buf.join("\n"));
    if (p) products.push(p);
  }
  return products;
}
