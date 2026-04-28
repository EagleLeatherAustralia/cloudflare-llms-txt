import llmsTxt from "../../llms.txt";
import securityTxt from "../../security.txt";

interface Env {
  FEED_BASE: string;
  // Set via `wrangler secret put` (see README). Optional — refresh endpoint
  // returns a 500 if any are missing rather than silently breaking.
  REFRESH_TOKEN?: string;
  PURGE_API_TOKEN?: string;
  PURGE_ZONE_ID?: string;
}

const PURGE_URLS = [
  "https://eagleleather.com.au/llms.txt",
  "https://www.eagleleather.com.au/llms.txt",
  "https://eagleleather.com.au/llms-full.txt",
  "https://www.eagleleather.com.au/llms-full.txt",
  "https://eagleleather.com.au/security.txt",
  "https://www.eagleleather.com.au/security.txt",
  "https://eagleleather.com.au/.well-known/security.txt",
  "https://www.eagleleather.com.au/.well-known/security.txt",
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Refresh trigger: header survives the apex→www redirect (Cloudflare
    // Redirect Rules don't preserve query strings by default), so prefer
    // X-Refresh-Token. Query param ?refresh= still works on direct www calls.
    const headerToken = request.headers.get("x-refresh-token");
    const queryToken = url.searchParams.get("refresh");
    if (headerToken || queryToken) {
      return handleRefresh(headerToken ?? queryToken ?? "", env);
    }

    if (url.pathname === "/llms.txt") {
      return new Response(llmsTxt, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Served-By": "cloudflare-llm-txt-worker",
        },
      });
    }

    if (
      url.pathname === "/.well-known/security.txt" ||
      url.pathname === "/security.txt"
    ) {
      return new Response(securityTxt, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
          "X-Served-By": "cloudflare-llm-txt-worker",
        },
      });
    }

    if (url.pathname === "/llms-full.txt") {
      const upstream = new URL("llms-full.txt", env.FEED_BASE).toString();
      const response = await fetch(upstream, {
        cf: { cacheTtl: 3600, cacheEverything: true },
      });

      const headers = new Headers(response.headers);
      headers.set("Content-Type", "text/plain; charset=utf-8");
      headers.set("X-Served-By", "cloudflare-llm-txt-worker");

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleRefresh(token: string, env: Env): Promise<Response> {
  if (!env.REFRESH_TOKEN) {
    return new Response("refresh: REFRESH_TOKEN not configured\n", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!token || token !== env.REFRESH_TOKEN) {
    return new Response("refresh: invalid token\n", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!env.PURGE_API_TOKEN || !env.PURGE_ZONE_ID) {
    return new Response(
      "refresh: PURGE_API_TOKEN and PURGE_ZONE_ID secrets are not configured\n",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const purgeRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.PURGE_ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PURGE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: PURGE_URLS }),
    }
  );

  if (!purgeRes.ok) {
    return new Response("refresh: purge failed\n", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response("OK\n", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
