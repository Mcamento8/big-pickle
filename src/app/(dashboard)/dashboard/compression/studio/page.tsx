"use client";
import { Suspense, useState } from "react";
import dynamic from "next/dynamic";

// Lazy-load the heavy compression views — they pull in compression engines
// and analysis UI that most visitors never touch.
const PlayView = dynamic(() => import("./PlayView").then((m) => m.PlayView), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-text-muted">Loading…</div>,
});
const CompareView = dynamic(() => import("./CompareView").then((m) => m.CompareView), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-text-muted">Loading…</div>,
});

export default function CompressionStudioPage() {
  const [tab, setTab] = useState<"play" | "compare">("play");
  const [text, setText] = useState("");
  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-[480px] flex-col p-4">
      <div className="mb-3 flex gap-2">
        <button data-testid="tab-play" aria-pressed={tab === "play"} onClick={() => setTab("play")}>Play</button>
        <button data-testid="tab-compare" aria-pressed={tab === "compare"} onClick={() => setTab("compare")}>Compare</button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "play" ? <PlayView text={text} onText={setText} /> : <CompareView text={text} />}
      </div>
    </div>
  );
}
