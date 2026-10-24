export type DesktopWorkbenchMode = "split" | "code" | "preview";

export interface WorkbenchLayout {
  mode: DesktopWorkbenchMode;
  codePercent: number;
}

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayout = {
  mode: "split",
  codePercent: 54,
};

export const MIN_CODE_PERCENT = 30;
export const MAX_CODE_PERCENT = 72;

export function clampCodePercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WORKBENCH_LAYOUT.codePercent;
  return Math.min(MAX_CODE_PERCENT, Math.max(MIN_CODE_PERCENT, Math.round(value)));
}

export function codePercentFromPointer(clientX: number, left: number, width: number): number {
  if (!Number.isFinite(width) || width <= 0) return DEFAULT_WORKBENCH_LAYOUT.codePercent;
  return clampCodePercent(((clientX - left) / width) * 100);
}

/** Untrusted browser storage is validated before affecting the workbench layout. */
export function parseWorkbenchLayout(raw: string | null): WorkbenchLayout {
  if (!raw) return { ...DEFAULT_WORKBENCH_LAYOUT };
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return { ...DEFAULT_WORKBENCH_LAYOUT };
    const value = saved as Record<string, unknown>;
    const mode =
      value.mode === "code" || value.mode === "preview" || value.mode === "split"
        ? value.mode
        : DEFAULT_WORKBENCH_LAYOUT.mode;
    return {
      mode,
      codePercent: typeof value.codePercent === "number"
        ? clampCodePercent(value.codePercent)
        : DEFAULT_WORKBENCH_LAYOUT.codePercent,
    };
  } catch {
    return { ...DEFAULT_WORKBENCH_LAYOUT };
  }
}
