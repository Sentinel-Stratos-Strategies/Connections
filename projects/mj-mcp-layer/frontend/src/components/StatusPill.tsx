const stateLabels: Record<string, string> = {
  active: "active",
  anchored: "anchored",
  missing: "needs build",
  recording: "recording",
  watching: "watching",
};

export function StatusPill({ state }: { state: string }) {
  return <span className={`status status-${state}`}>{stateLabels[state] ?? state}</span>;
}
