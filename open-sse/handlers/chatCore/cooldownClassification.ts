import { HTTP_STATUS } from "../../config/constants.ts";
import { usesCcWireImage } from "../../services/ccWireImageBuiltins.ts";

/**
 * Whether a failed single-model attempt is a *self-inflicted* upstream timeout — i.e.
 * OmniRoute's own deadline (fetch-start `TimeoutError`, body `BodyTimeoutError`, or the
 * combo-per-model timeout) fired while the upstream was still processing the request,
 * surfaced as a 504 tagged `errorType: "upstream_timeout"`.
 *
 * Such a timeout is NOT a provider rejection — the connection is healthy, we just gave
 * up waiting — so the caller must skip the connection cooldown for it. Cooling the
 * connection down on our own timeout penalises a healthy account and, when a provider
 * has a single connection, blocks every subsequent request behind a self-inflicted
 * cooldown. Antigravity keeps its own pre-response-timeout cooldown policy and is
 * therefore excluded here.
 *
 * Two distinct cases are folded into this predicate:
 *
 *  1. Our own AbortController fired mid-request (status=504, errorType=upstream_timeout).
 *
 *  2. The upstream is a multi-hop aggregator from `CC_WIRE_IMAGE_BUILTINS` (currently
 *     `agentrouter`) and returns a raw nginx 504 Gateway Time-out HTML page. The
 *     aggregator's nginx layer has its own 60s default `proxy_read_timeout`; when the
 *     Claude / GLM / DeepSeek backend under it is slow (claude-opus-4-6 routinely
 *     takes 40-50s end-to-end) nginx surfaces a 504 with body `<html>...504 Gateway
 *     Time-out...nginx</html>`. The connection is healthy — the aggregator's
 *     upstream backend was simply slow — so we must NOT cool down the connection
 *     (which would cascade into a retry storm that hits the same 60s ceiling again
 *     3s later, see the test logs in #agentrouter-bug).
 *
 * Callers may pass `responseBody` (string) so we can spot the nginx HTML signature.
 */
export function isSelfInflictedUpstreamTimeout(
  status: number,
  errorType: string | undefined | null,
  provider: string,
  responseBody?: string | null
): boolean {
  if (status !== HTTP_STATUS.GATEWAY_TIMEOUT) return false;

  if (errorType === "upstream_timeout" && provider !== "antigravity") return true;

  // Aggregator providers that proxy through CC_WIRE_IMAGE_BUILTINS return a raw
  // nginx HTML 504 page when their backend times out. Treat those the same as
  // our own deadline firing — the connection is fine, the upstream is just slow.
  if (
    usesCcWireImage(provider) &&
    typeof responseBody === "string" &&
    responseBody.length > 0 &&
    responseBody.length < 4096 &&
    /<html>[\s\S]*504\s+Gateway\s+Time-?out[\s\S]*<center>nginx<\/center>/i.test(responseBody)
  ) {
    return true;
  }

  return false;
}
