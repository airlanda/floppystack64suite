export type Fs64RemoteIcon = 'disk' | 'games' | 'play' | 'config' | 'profile' | 'default';

export interface Fs64RemoteManifestEntry {
  id: string;
  name: string;
  entry: string;
  route: string;
  scope?: string;
  exposedModule?: string;
  icon?: Fs64RemoteIcon;
  order?: number;
  enabled?: boolean;
  category?: string;
  description?: string;
  version?: string;
  requiresAuth?: boolean;
}

export interface Fs64RemoteManifest {
  remotes: Fs64RemoteManifestEntry[];
}

export interface Fs64ResolvedRemoteManifestEntry extends Fs64RemoteManifestEntry {
  scope: string;
  exposedModule: string;
  icon: Fs64RemoteIcon;
  order: number;
  enabled: boolean;
  requiresAuth: boolean;
}

export interface Fs64RemoteContainer {
  init: (shareScope: unknown) => Promise<void> | void;
  get: (module: string) => Promise<() => unknown>;
}

const REMOTE_ICON_SET = new Set<Fs64RemoteIcon>(['disk', 'games', 'play', 'config', 'profile', 'default']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function assertRemoteEntryShape(remote: Fs64RemoteManifestEntry, index: number): void {
  if (!isNonEmptyString(remote.id)) {
    throw new Error(`Remote manifest entry at index ${index} is missing a valid id.`);
  }

  if (!isNonEmptyString(remote.name)) {
    throw new Error(`Remote manifest entry "${remote.id}" is missing a valid name.`);
  }

  if (!isNonEmptyString(remote.entry)) {
    throw new Error(`Remote manifest entry "${remote.id}" is missing a valid entry URL.`);
  }

  if (!isNonEmptyString(remote.route)) {
    throw new Error(`Remote manifest entry "${remote.id}" is missing a valid route.`);
  }

  if (remote.icon && !REMOTE_ICON_SET.has(remote.icon)) {
    throw new Error(`Remote manifest entry "${remote.id}" has an unsupported icon "${remote.icon}".`);
  }
}

// Normalize the runtime manifest once so the host/router can consume a stable contract.
export function resolveFs64RemoteManifest(manifest: Fs64RemoteManifest): Fs64ResolvedRemoteManifestEntry[] {
  if (!manifest || !Array.isArray(manifest.remotes)) {
    throw new Error('FS64 remote manifest must contain a remotes array.');
  }

  const seenIds = new Set<string>();
  const seenRoutes = new Set<string>();

  return manifest.remotes
    .map((remote, index) => {
      assertRemoteEntryShape(remote, index);

      const normalizedRoute = normalizeRoute(remote.route);
      if (seenIds.has(remote.id)) {
        throw new Error(`Duplicate remote id "${remote.id}" found in FS64 manifest.`);
      }
      if (seenRoutes.has(normalizedRoute)) {
        throw new Error(`Duplicate remote route "${normalizedRoute}" found in FS64 manifest.`);
      }

      seenIds.add(remote.id);
      seenRoutes.add(normalizedRoute);

      return {
        ...remote,
        route: normalizedRoute,
        scope: remote.scope ?? remote.id,
        exposedModule: remote.exposedModule ?? './Module',
        icon: remote.icon ?? 'default',
        order: remote.order ?? Number.MAX_SAFE_INTEGER,
        enabled: remote.enabled ?? true,
        requiresAuth: remote.requiresAuth ?? false,
      } satisfies Fs64ResolvedRemoteManifestEntry;
    })
    .filter((remote) => remote.enabled)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

// Fetching the manifest from a host-served JSON file removes host rebuilds for metadata-only remote changes.
export async function fetchFs64RemoteManifest(url: string): Promise<Fs64ResolvedRemoteManifestEntry[]> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load FS64 remote manifest from ${url} (${response.status}).`);
  }

  const manifest = (await response.json()) as Fs64RemoteManifest;
  return resolveFs64RemoteManifest(manifest);
}
