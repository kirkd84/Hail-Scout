/** Storm record from /v1/storms or /v1/hail-at-address. */
export interface Storm {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  centroid?: { lat: number; lng: number } | null;
  bbox?: { min_lat: number; min_lng: number; max_lat: number; max_lng: number } | null;
  source: string;
}

/** Per-storm hail observation at an address. */
export interface HailEvent {
  storm_id: string;
  hail_size_in: number;
  observed_at: string;
}

/** Response from GET /v1/hail-at-address?address=... */
export interface HailAtAddressResponse {
  query: { address?: string; lat?: number; lng?: number };
  resolved: { lat: number; lng: number; formatted_address?: string };
  events: HailEvent[];
  storms: Storm[];
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
