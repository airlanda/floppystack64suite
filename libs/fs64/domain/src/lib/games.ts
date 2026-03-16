export type Fs64GameLocation = {
  diskId: string;
  side: 'sideA' | 'sideB';
  sideLabel: string;
  slot: number;
  datasetKey?: string | null;
  datasetName?: string | null;
  rating?: number | null;
};

export type Fs64GameSearchMetadata = {
  canonicalTitle?: string | null;
  description?: string | null;
  genre?: string | null;
  developer?: string | null;
  publisher?: string | null;
  year?: string | null;
  players?: string | null;
  images?: {
    boxFront?: string;
    screenshot?: string;
    logo?: string;
  };
  source?: Record<string, unknown> | null;
  updatedAt?: string | null;
};

export type Fs64GameSearchResult = {
  key: string;
  gameName: string;
  normalizedName: string;
  locations: Fs64GameLocation[];
  metadata: Fs64GameSearchMetadata | null;
};

export type Fs64GameSearchResponse = {
  dataset: string;
  q: string;
  total: number;
  returned: number;
  results: Fs64GameSearchResult[];
};

import { getApiBaseUrl } from './disks';

export async function searchGames(payload: { q?: string; dataset?: string; limit?: number } = {}): Promise<Fs64GameSearchResponse> {
  const apiBase = getApiBaseUrl();
  const params = new URLSearchParams();
  if (payload.q) params.set('q', payload.q);
  if (payload.dataset) params.set('dataset', payload.dataset);
  params.set('limit', String(payload.limit ?? 250));

  const response = await fetch(`${apiBase}/api/games/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load games: ${response.status}`);
  }

  return response.json();
}
