import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { FS64_BACKEND_API_BASE, normalizeFs64Route } from './api';
import {
  Fs64AngularRemoteManifest,
  Fs64AngularRemoteManifestEntry,
  Fs64ResolvedAngularRemoteManifestEntry,
} from './contracts';

function assertRemote(remote: Fs64AngularRemoteManifestEntry, index: number): void {
  if (!remote.id?.trim()) {
    throw new Error(`Angular remote entry at index ${index} is missing an id.`);
  }
  if (!remote.name?.trim()) {
    throw new Error(`Angular remote "${remote.id}" is missing a name.`);
  }
  if (!remote.remoteName?.trim()) {
    throw new Error(`Angular remote "${remote.id}" is missing a remoteName.`);
  }
  if (!remote.remoteEntry?.trim()) {
    throw new Error(`Angular remote "${remote.id}" is missing a remoteEntry.`);
  }
  if (!remote.route?.trim()) {
    throw new Error(`Angular remote "${remote.id}" is missing a route.`);
  }
}

export function resolveAngularRemoteManifest(
  manifest: Fs64AngularRemoteManifest
): Fs64ResolvedAngularRemoteManifestEntry[] {
  if (!Array.isArray(manifest?.remotes)) {
    throw new Error('Angular remote manifest must contain a remotes array.');
  }

  const seenIds = new Set<string>();
  const seenRoutes = new Set<string>();

  return manifest.remotes
    .map((remote, index) => {
      assertRemote(remote, index);

      const route = normalizeFs64Route(remote.route);
      if (seenIds.has(remote.id)) {
        throw new Error(`Duplicate Angular remote id "${remote.id}".`);
      }
      if (seenRoutes.has(route)) {
        throw new Error(`Duplicate Angular remote route "${route}".`);
      }

      seenIds.add(remote.id);
      seenRoutes.add(route);

        return {
          ...remote,
          route,
          routePath: route.replace(/^\/+/, ''),
          exposedModule: remote.exposedModule ?? 'mount',
          enabled: remote.enabled ?? true,
          order: remote.order ?? Number.MAX_SAFE_INTEGER,
        } satisfies Fs64ResolvedAngularRemoteManifestEntry;
    })
    .filter((remote) => remote.enabled)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

@Injectable({ providedIn: 'root' })
export class Fs64AngularManifestService {
  private readonly http = inject(HttpClient);
  private readonly backendUrl = `${FS64_BACKEND_API_BASE}/mfe/manifest?manifest=angular`;
  private readonly fallbackUrl = '/fs64-angular-remotes.json';
  private manifestPromise: Promise<Fs64ResolvedAngularRemoteManifestEntry[]> | null = null;

  load(): Promise<Fs64ResolvedAngularRemoteManifestEntry[]> {
    if (!this.manifestPromise) {
      this.manifestPromise = this.fetchManifest();
    }

    return this.manifestPromise;
  }

  private async fetchManifest(): Promise<Fs64ResolvedAngularRemoteManifestEntry[]> {
    try {
      const manifest = await firstValueFrom(
        this.http.get<Fs64AngularRemoteManifest>(this.backendUrl)
      );
      return resolveAngularRemoteManifest(manifest);
    } catch {
      const fallback = await firstValueFrom(
        this.http.get<Fs64AngularRemoteManifest>(this.fallbackUrl)
      );
      return resolveAngularRemoteManifest(fallback);
    }
  }
}
