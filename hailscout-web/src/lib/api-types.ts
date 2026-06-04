/** Storm record from /v1/storms or /v1/hail-at-address. */
export interface Storm {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  /** Centroid coordinates (flat — preferred by UI components). */
  centroid_lat: number;
  centroid_lng: number;
  /** Bounding box of the swath. */
  bbox: { min_lat: number; min_lng: number; max_lat: number; max_lng: number };
  source: string;
  /**
   * SPC Local Storm Report confirmation (Phase 23). True when a
   * ground-truth report fell inside this cell within ±30 min.
   * `lsr_observed_size_in` carries the reported size (often within
   * 0.25″ of the radar's estimated size); `lsr_observed_at` is the
   * report timestamp.
   */
  lsr_confirmed?: boolean;
  lsr_observed_size_in?: number | null;
  lsr_observed_at?: string | null;
  /**
   * False-positive screening (Phase 23.5). `confidence` is in [0, 1];
   * the API default-hides rows with `suspect=true` unless the request
   * passes `include_unconfirmed=1`. Reasons are explanatory tags from
   * the screener (e.g. "implausibly_small_for_size",
   * "no_lsr_near_denver").
   */
  confidence?: number;
  suspect?: boolean;
  suspect_reasons?: string[];
  /** Phase 24 dual-pol persistence (NEXRAD only). */
  hail_confirmed?: boolean;
  peak_dbz?: number | null;
  /** Phase 24 multi-source verification (present on at-point results). */
  verification?: Verification;
  /**
   * Address-lookup context (present on at-point results). `size_at_point`
   * is the size that fell at the queried point; `storm_peak_size_in` is
   * the storm's peak anywhere in its footprint. For address surfaces
   * `max_hail_size_in` is set to the at-point size.
   */
  size_at_point?: number | null;
  storm_peak_size_in?: number;
}

/** One itemized piece of evidence in a verification breakdown. */
export interface VerificationSignal {
  key: string;
  label: string;
  present: boolean;
  detail: string;
}

/**
 * Multi-source verification (Phase 24) — the competitive differentiator.
 * tier ∈ ground_truth_confirmed | dual_pol_confirmed | multi_source |
 * radar_indicated | unverified.
 */
export interface Verification {
  tier: string;
  tier_label: string;
  tier_rank: number;
  confidence: number;
  headline: string;
  defensibility: string;
  signals: VerificationSignal[];
}

/** Per-storm hail observation at an address. */
export interface HailEvent {
  storm_id: string;
  hail_size_in: number;
  observed_at: string;
}

/** Response from GET /v1/hail-at-address?address=... */
export interface HailAtAddressResponse {
  /** Resolved coordinates of the queried address. */
  lat: number;
  lng: number;
  /** Pretty-printed address string from the geocoder. */
  address: string;
  /** All storms whose swaths contain the resolved point. */
  storms: Storm[];
  /** Optional per-storm hail observations at this point. */
  events?: HailEvent[];
}

/** Map vector-tile feature properties (output of hailscout-tiles). */
export interface SwathFeatureProps {
  hail_size: string;
  category: number;
  storm_id: string;
  start_time: string;
  end_time: string;
  max_size_in: number;
}
