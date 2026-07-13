"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useLiveComboStatus } from "@/hooks/useLiveDashboard";
import { useProviderBreakerHealth } from "@/hooks/useProviderBreakerHealth";

// Lazy-load the heavy react-flow studio to keep the initial JS bundle lean.
// @xyflow/react + its dependency tree is ~300 KB gzip — no need to ship it
// to every dashboard visit.
const ComboLiveStudio = dynamic(() => import("./ComboLiveStudio").then((m) => m.ComboLiveStudio), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-text-muted">
      Loading studio…
    </div>
  ),
});

/**
 * Combo/Routing Studio (Tela B) — live combo cascade.
 *
 * Thin route wrapper: subscribes to the `combo` WS channel via
 * `useLiveComboStatus` and feeds the events into the studio. `LiveComboEvent` is
 * structurally compatible with the studio's `ComboEventInput`. The studio shows a
 * "Live disabled" banner + empty state when the WS feed is off, so this degrades
 * gracefully. `useProviderBreakerHealth` overlays the real circuit-breaker state
 * (U1b) from the monitoring health snapshot — fail-soft, so it never breaks the
 * cascade when the endpoint is unavailable.
 */
export default function ComboLiveStudioPage() {
  const { comboEvents, activeCombos, isConnected } = useLiveComboStatus();
  const { providerHealth, connectionHealth } = useProviderBreakerHealth();

  return (
    <div className="p-4 h-[calc(100dvh-6rem)] min-h-[480px]">
      <ComboLiveStudio
        comboEvents={comboEvents}
        combos={[...activeCombos]}
        isConnected={isConnected}
        providerHealth={providerHealth}
        connectionHealth={connectionHealth}
      />
    </div>
  );
}
