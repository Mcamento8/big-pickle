/**
 * liveServerAllowList — extract of the host/origin allow-list logic from
 * `src/server/ws/liveServer.ts`.
 *
 * Lives in its own module so unit tests can exercise it without booting the
 * full WebSocket server. The behaviour here MUST match the one used by the
 * connection handler exactly.
 *
 * Bug #1 (plans/2026-06-23-omniroute-v3.8.34-deep-audit.md) added the
 * `LIVE_WS_ALLOWED_HOSTS` opt-in for LAN/Tailscale deployments.
 */

const DEFAULT_HOST = "127.0.0.1";

/**
 * Default origins allowed to open a WebSocket against the local dashboard.
 * These match the loopback HTTP listener at port 20128.
 */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = Object.freeze([
  "http://127.0.0.1:20128",
  "http://localhost:20128",
  "http://[::1]:20128",
]);

/**
 * Parse a comma-separated env value into a set of trimmed, non-empty entries.
 * Centralized so tests can exercise empty / whitespace / dup behaviour.
 */
export function parseCsvEnv(value: string | undefined | null): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Build the static origin allow-list from defaults + LIVE_WS_ALLOWED_ORIGINS.
 */
export function buildAllowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const extra = parseCsvEnv(env.LIVE_WS_ALLOWED_ORIGINS);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}

/**
 * Build the host-based allow-list (LAN/Tailscale extension).
 */
export function buildAllowedHosts(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return parseCsvEnv(env.LIVE_WS_ALLOWED_HOSTS);
}

/**
 * Parse the host portion of an Origin URL.
 *
 * Returns `null` when the input is not a well-formed absolute URL — callers
 * should treat `null` as "not a match".
 */
export function originHost(origin: string): { host: string; hostname: string } | null {
  try {
    const url = new URL(origin);
    return { host: url.host, hostname: url.hostname };
  } catch {
    return null;
  }
}

/**
 * Whether the given Origin's host (or `host:port`) is in the host
 * allow-list. Returns false when the list is empty.
 */
export function originHostMatches(origin: string, allowedHosts: Set<string>): boolean {
  if (allowedHosts.size === 0) return false;
  const parsed = originHost(origin);
  if (!parsed) return false;
  return allowedHosts.has(parsed.host) || allowedHosts.has(parsed.hostname);
}

/**
 * Top-level Origin allow decision. The contract:
 *
 *   - When `origin` is undefined (no Origin header, e.g. CLI/MCP), we only
 *     accept the request when the WS listener is bound to loopback. This
 *     prevents drive-by LAN clients from omitting Origin to bypass the
 *     browser-side check.
 *
 *   - When `origin` is present, we accept it if it matches an entry in the
 *     static origin list (defaults + LIVE_WS_ALLOWED_ORIGINS) or if its
 *     host matches an entry in the LAN allow-list (LIVE_WS_ALLOWED_HOSTS).
 */
export function isOriginAllowed(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  options: { allowedOrigins?: Set<string>; allowedHosts?: Set<string> } = {}
): boolean {
  const allowedOrigins = options.allowedOrigins ?? buildAllowedOrigins(env);
  const allowedHosts = options.allowedHosts ?? buildAllowedHosts(env);

  const listenerHost = env.LIVE_WS_HOST || DEFAULT_HOST;
  const isLoopbackOnly =
    listenerHost === "127.0.0.1" ||
    listenerHost === "::1" ||
    listenerHost === "localhost";

  if (!origin) {
    // Non-browser clients (CLI / MCP) omit Origin — accept only when the WS
    // listener is bound to loopback so drive-by LAN clients cannot bypass the
    // browser-side check by stripping the header.
    return isLoopbackOnly;
  }
  if (allowedOrigins.has(origin)) return true;
  if (originHostMatches(origin, allowedHosts)) return true;

  // When the WS listener is loopback-bound, accept any same-host loopback
  // origin on any port — Next.js dev uses a random port (e.g. 34788) per
  // restart, and the dashboard opens from there. The browser will only send
  // a usable Origin when the document was loaded from a real loopback URL,
  // so accepting every loopback port is no wider than "any 127.0.0.1:* tab
  // on this machine can already do XHR against this WS port". Cross-host
  // attacks require spoofing an Origin header, which browsers won't do.
  if (isLoopbackOnly && isLoopbackOrigin(origin)) return true;

  return false;
}

/**
 * True when `origin` is any loopback URL on any port — used to accept
 * `http://127.0.0.1:<random>`, `http://localhost:<random>`, `[::1]` variants
 * when the LiveWS listener itself is bound to loopback. Intentionally
 * permissive only on the loopback boundary; non-loopback listeners must use
 * the explicit allow-list (LIVE_WS_ALLOWED_ORIGINS / LIVE_WS_ALLOWED_HOSTS).
 *
 * URL.hostname preserves the IPv6 literal WITH brackets (e.g. `[::1]`),
 * so both `::1` and `[::1]` must be checked.
 */
function isLoopbackOrigin(origin: string): boolean {
  const parsed = originHost(origin);
  if (!parsed) return false;
  const host = parsed.hostname;
  return (
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host === "localhost"
  );
}
