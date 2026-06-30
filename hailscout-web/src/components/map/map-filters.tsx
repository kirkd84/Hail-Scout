// Shared hail-size / data-source filter options and helpers.
//
// The old `MapFilters` control surface (and its date-range options) was
// replaced by `storm-date-picker.tsx`. These size/source constants and the
// `sizeFilterToMin` helper live on because the new desktop picker, the
// mobile control sheet, and the map page all share them.

export type SizeFilter = "any" | "1.0" | "1.75" | "2.5";
export type SourceFilter = "all" | "MRMS" | "NEXRAD";

export const SIZE_OPTIONS: { id: SizeFilter; label: string; min: number }[] = [
  { id: "any",  label: "Any size", min: 0 },
  { id: "1.0",  label: "≥ 1.0″",   min: 1.0  },
  { id: "1.75", label: "≥ 1.75″",  min: 1.75 },
  { id: "2.5",  label: "≥ 2.5″",   min: 2.5  },
];

export const SOURCE_OPTIONS: { id: SourceFilter; label: string }[] = [
  { id: "all",    label: "All sources" },
  { id: "MRMS",   label: "MRMS (1 km)" },
  { id: "NEXRAD", label: "NEXRAD (150 m)" },
];

export function sizeFilterToMin(f: SizeFilter): number {
  return SIZE_OPTIONS.find((o) => o.id === f)?.min ?? 0;
}
