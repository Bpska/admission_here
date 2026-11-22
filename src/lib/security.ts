/**
 * Validates whether an incoming HTTP request is same-site / same-origin.
 * Protects state-changing endpoints against CSRF while being fully compatible
 * with reverse-proxy deployment environments (Docker, Nginx, Cloudflare, Vercel, etc.).
 */
export function isSameSiteRequest(request: Request): boolean {
  // 1. Check sec-fetch-site header (supported by modern browsers)
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return false;
  }
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return true;
  }

  // 2. Fallback to Origin / Referer validation if sec-fetch-site is absent
  const originHeader = request.headers.get("origin") || request.headers.get("referer");
  if (!originHeader) {
    // Non-CORS same-origin requests or direct browser submissions often omit Origin
    return true;
  }

  try {
    const originUrl = new URL(originHeader);
    const originHost = originUrl.host.toLowerCase();
    const originHostname = originUrl.hostname.toLowerCase();

    // Collect all valid host candidates for this server
    const validHosts = new Set<string>();

    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost) {
      forwardedHost.split(",").forEach((h) => validHosts.add(h.trim().toLowerCase()));
    }

    const hostHeader = request.headers.get("host");
    if (hostHeader) {
      validHosts.add(hostHeader.toLowerCase());
    }

    try {
      const reqUrl = new URL(request.url);
      validHosts.add(reqUrl.host.toLowerCase());
      validHosts.add(reqUrl.hostname.toLowerCase());
    } catch {}

    const envUrls = [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.AUTH_URL,
      process.env.NEXTAUTH_URL,
      process.env.APP_URL,
    ];
    for (const envUrl of envUrls) {
      if (envUrl) {
        try {
          const u = new URL(envUrl);
          validHosts.add(u.host.toLowerCase());
          validHosts.add(u.hostname.toLowerCase());
        } catch {}
      }
    }

    // Direct match (including port)
    if (validHosts.has(originHost)) return true;

    // Match hostname ignoring port (e.g. localhost:3000 vs localhost) or www/non-www
    for (const vh of validHosts) {
      const vhHostname = vh.split(":")[0];
      if (originHostname === vhHostname) return true;
      if (originHostname.replace(/^www\./, "") === vhHostname.replace(/^www\./, "")) return true;
    }

    return false;
  } catch {
    return false;
  }
}

