import type { RegistryEntry } from "../../shared.ts";

export const agentrouterProvider: RegistryEntry = {
  id: "agentrouter",
  alias: "agentrouter",
  format: "claude",
  executor: "default",
  baseUrl: "https://agentrouter.org/v1/messages",
  authType: "apikey",
  authHeader: "x-api-key",
  defaultContextLength: 128000,
  // No static `headers` here: agentrouter now adopts the DYNAMIC Claude-Code
  // wire image via CC_WIRE_IMAGE_BUILTINS (#6056) — the fingerprint/headers are
  // applied by buildProviderHeaders + applyFingerprint, keeping this entry's
  // own baseUrl + x-api-key auth. A static fingerprint here would drift and
  // trip AgentRouter's WAF ("unauthorized client detected").
  //
  // The WAF additionally rejects the default MacOS/arm64 fingerprint and only
  // accepts a linux/x64 CLI signature — `provider.ts::buildProviderHeaders`
  // overrides X-Stainless-OS/X-Stainless-Arch for every CC_WIRE_IMAGE_BUILTINS
  // provider so this fingerprint swap happens in one place.
  //
  // Model availability is gated by the upstream account's `default` channel
  // group and varies per token. Only advertise models verified-live against
  // the current account here; everything else surfaces a 503
  // ("无可用渠道" / no available channel) on every test, which makes the
  // dashboard unusable. `passthroughModels: true` still lets users add more
  // model ids from /api/provider-nodes without touching this file.
  models: [{ id: "claude-opus-4-6", name: "Claude 4.6 Opus" }],
  passthroughModels: true,
};
