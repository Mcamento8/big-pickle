import test from "node:test";
import assert from "node:assert/strict";
import { isSelfInflictedUpstreamTimeout } from "../../open-sse/handlers/chatCore/cooldownClassification.ts";
import { HTTP_STATUS } from "../../open-sse/config/constants.ts";

const NGINX_504_HTML = `<html>
<head><title>504 Gateway Time-out</title></head>
<body>
<center><h1>504 Gateway Time-out</h1></center>
<hr><center>nginx</center>
</body>
</html>`;

test("self-inflicted: our own upstream_timeout on non-antigravity still skips cooldown", () => {
  assert.equal(
    isSelfInflictedUpstreamTimeout(HTTP_STATUS.GATEWAY_TIMEOUT, "upstream_timeout", "claude"),
    true
  );
  assert.equal(
    isSelfInflictedUpstreamTimeout(HTTP_STATUS.GATEWAY_TIMEOUT, "upstream_timeout", "agentrouter"),
    true
  );
});

test("antigravity keeps its own policy — upstream_timeout still triggers cooldown", () => {
  assert.equal(
    isSelfInflictedUpstreamTimeout(HTTP_STATUS.GATEWAY_TIMEOUT, "upstream_timeout", "antigravity"),
    false
  );
});

test("agentrouter nginx 504 HTML body is treated as self-inflicted upstream timeout", () => {
  // The CC_WIRE_IMAGE_BUILTINS aggregator's nginx layer surfaces a raw 504
  // page when its upstream backend (claude/glm/deepseek) is slow. The
  // connection is healthy — cooling it down would trigger a 3s retry storm
  // that hits the same 60s ceiling again.
  assert.equal(
    isSelfInflictedUpstreamTimeout(
      HTTP_STATUS.GATEWAY_TIMEOUT,
      undefined,
      "agentrouter",
      NGINX_504_HTML
    ),
    true
  );
});

test("other providers' 504 HTML bodies do NOT trigger self-inflicted skip", () => {
  // Only CC_WIRE_IMAGE_BUILTINS aggregators are known to proxy through a raw
  // nginx layer. Other providers' 504s still indicate account/provider issues
  // and must cool down normally.
  assert.equal(
    isSelfInflictedUpstreamTimeout(
      HTTP_STATUS.GATEWAY_TIMEOUT,
      undefined,
      "openai",
      NGINX_504_HTML
    ),
    false
  );
  assert.equal(
    isSelfInflictedUpstreamTimeout(
      HTTP_STATUS.GATEWAY_TIMEOUT,
      undefined,
      "claude",
      NGINX_504_HTML
    ),
    false
  );
});

test("non-504 statuses never trigger self-inflicted skip", () => {
  assert.equal(
    isSelfInflictedUpstreamTimeout(HTTP_STATUS.SERVICE_UNAVAILABLE, "upstream_timeout", "agentrouter", NGINX_504_HTML),
    false
  );
  assert.equal(
    isSelfInflictedUpstreamTimeout(HTTP_STATUS.BAD_GATEWAY, undefined, "agentrouter", NGINX_504_HTML),
    false
  );
  assert.equal(
    isSelfInflictedUpstreamTimeout(HTTP_STATUS.GATEWAY_TIMEOUT, undefined, "agentrouter", null),
    false
  );
});

test("504 with non-nginx body is still a real account failure", () => {
  // JSON error from Anthropic-shaped provider, not nginx HTML — the provider
  // explicitly returned this 504, so it must cool down.
  const jsonBody = JSON.stringify({
    type: "error",
    error: { type: "overloaded_error", message: "upstream is overloaded" },
  });
  assert.equal(
    isSelfInflictedUpstreamTimeout(HTTP_STATUS.GATEWAY_TIMEOUT, undefined, "agentrouter", jsonBody),
    false
  );
});
