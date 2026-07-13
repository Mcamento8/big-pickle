export default function ComboLiveLoading() {
  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-[480px] items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Loading Combo Studio…</span>
      </div>
    </div>
  );
}
