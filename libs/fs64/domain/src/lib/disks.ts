export type Fs64Game = {
  gameName: string;
  rating?: number;
  [key: string]: unknown;
};

export type Fs64Disk = {
  _id: string;
  datasetKey?: string;
  label?: string;
  sideA?: Array<string | Fs64Game>;
  sideB?: Array<string | Fs64Game>;
  [key: string]: unknown;
};

export type Fs64MetadataProvider = 'thegamesdb' | 'hybrid';

export type Fs64MetadataRecord = {
  gameName?: string;
  canonicalTitle?: string;
  description?: string;
  genre?: string;
  developer?: string;
  publisher?: string;
  year?: string;
  players?: string;
  images?: {
    boxFront?: string;
    screenshot?: string;
    logo?: string;
  };
  [key: string]: unknown;
};

export function normalizeGameTitle(game: string | Fs64Game): string {
  return typeof game === 'string' ? game : String(game?.gameName || '').trim();
}

export function countDiskGames(disk: Fs64Disk): number {
  return (disk.sideA?.length || 0) + (disk.sideB?.length || 0);
}

function normalizeName(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ');
}

function pickBestRecord(records: Fs64MetadataRecord[], gameName: string) {
  if (!records.length) return null;
  const wanted = normalizeName(gameName);
  return (
    records.find((record) => normalizeName(record?.gameName) === wanted) ||
    records.find((record) => normalizeName(record?.canonicalTitle) === wanted) ||
    records[0]
  );
}

export function getApiBaseUrl(): string {
  const explicit = (globalThis as typeof globalThis & { __FS64_API_BASE_URL__?: string }).__FS64_API_BASE_URL__;
  if (explicit) return explicit;

  if (typeof window === 'undefined') {
    return 'http://localhost:5000';
  }

  const { protocol, hostname, port } = window.location;
  if (port === '5000') return `${protocol}//${hostname}:5000`;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^192\.168\./.test(hostname)) {
    return `${protocol}//${hostname}:5000`;
  }

  return '';
}

export async function fetchDisks(dataset?: string): Promise<Fs64Disk[]> {
  const apiBase = getApiBaseUrl();
  const query = dataset ? `?dataset=${encodeURIComponent(dataset)}` : '';
  const response = await fetch(`${apiBase}/api/items/disks${query}`);
  if (!response.ok) {
    throw new Error(`Failed to load disks: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export async function updateDiskGameRating(payload: {
  dataset: string;
  diskId: string;
  side: 'sideA' | 'sideB';
  gameIndex: number;
  gameName: string;
  rating: number;
  previousRating?: number | null;
}) {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/items/ratings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save rating: ${response.status}`);
  }

  return response.json();
}

export async function saveDiskGameTitles(payload: {
  dataset: string;
  diskId: string;
  side: 'sideA' | 'sideB';
  titles: string[];
}) {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/items/titles`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save titles: ${response.status}`);
  }

  return response.json();
}

export async function deleteDiskFromDataset(payload: { dataset: string; diskId: string }) {
  const apiBase = getApiBaseUrl();
  const response = await fetch(
    `${apiBase}/api/items/disks/${encodeURIComponent(payload.diskId)}?dataset=${encodeURIComponent(
      payload.dataset || 'default'
    )}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete disk: ${response.status}`);
  }

  return response.json();
}

export async function fetchMetadataRecord(gameName: string): Promise<Fs64MetadataRecord | null> {
  const apiBase = getApiBaseUrl();
  const response = await fetch(
    `${apiBase}/api/metadata/records?q=${encodeURIComponent(gameName)}&limit=25`
  );

  if (!response.ok) {
    throw new Error(`Failed to load metadata: ${response.status}`);
  }

  const payload = await response.json();
  const records = Array.isArray(payload?.records) ? payload.records : [];
  return pickBestRecord(records, gameName);
}


export async function lookupMetadataRecord(payload: {
  gameName: string;
  provider: Fs64MetadataProvider;
  persist?: boolean;
  downloadImages?: boolean;
}): Promise<Fs64MetadataRecord | null> {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/metadata/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameName: payload.gameName,
      provider: payload.provider,
      persist: payload.persist ?? true,
      downloadImages: payload.downloadImages ?? true,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Failed metadata lookup: ${response.status}`);
  }

  return result?.stored || result?.result || null;
}
