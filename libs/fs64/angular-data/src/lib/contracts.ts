import type { Fs64Disk, Fs64GameSearchResponse } from '@fs64/domain';

export interface Fs64AngularRemoteManifestEntry {
  id: string;
  name: string;
  route: string;
  remoteName: string;
  remoteEntry: string;
  exposedModule?: string;
  description?: string;
  order?: number;
  enabled?: boolean;
}

export interface Fs64AngularRemoteManifest {
  remotes: Fs64AngularRemoteManifestEntry[];
}

export interface Fs64ResolvedAngularRemoteManifestEntry extends Fs64AngularRemoteManifestEntry {
  exposedModule: string;
  enabled: boolean;
  order: number;
  routePath: string;
}

export interface Fs64MountedRemote {
  destroy: () => void;
}

export interface Fs64DiskStore {
  id: string;
  key: string;
  name: string;
  diskCount?: number;
  enabled?: boolean;
  sourceType?: string;
  path?: string | null;
}

export interface Fs64DiskStoresResponse {
  stores: Fs64DiskStore[];
  activeStoreKeys: string[];
}

export type Fs64DiskRecord = Fs64Disk;
export type Fs64GamesSearchResponse = Fs64GameSearchResponse;
