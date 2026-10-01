// Start-URL rule shared by the settings page and the lock engine.

const ALLOWED_PROTOCOLS = ["http:", "https:", "about:"];

/** Returns the normalized href, or null if `raw` isn't an allowed URL (bare hosts get https://). */
export function normalizeUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  for (const candidate of [text, `https://${text}`]) {
    try {
      const url = new URL(candidate);
      if (ALLOWED_PROTOCOLS.includes(url.protocol)) return url.href;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}
