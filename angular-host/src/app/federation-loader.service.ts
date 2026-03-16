import { Injectable } from '@angular/core';
import {
  fetchFs64RemoteManifest,
  Fs64ResolvedRemoteManifestEntry,
  loadFs64RemoteModule,
} from '@fs64/registry';

@Injectable({ providedIn: 'root' })
export class FederationLoaderService {
  private readonly manifestUrl = '/fs64-remotes.json';
  private manifestPromise: Promise<Fs64ResolvedRemoteManifestEntry[]> | null = null;

  private loadManifest(): Promise<Fs64ResolvedRemoteManifestEntry[]> {
    if (!this.manifestPromise) {
      this.manifestPromise = fetchFs64RemoteManifest(this.manifestUrl);
    }

    return this.manifestPromise;
  }

  async getRemoteById(id: string, exposedModule = './Module'): Promise<Fs64ResolvedRemoteManifestEntry> {
    const manifest = await this.loadManifest();
    const remote = manifest.find((entry) => entry.id === id);

    if (!remote) {
      throw new Error(`FS64 remote "${id}" was not found in ${this.manifestUrl}.`);
    }

    return {
      ...remote,
      exposedModule,
    };
  }

  async loadRemoteById<T>(id: string, exposedModule = './Module'): Promise<T> {
    const remote = await this.getRemoteById(id, exposedModule);
    return loadFs64RemoteModule<T>(remote);
  }
}
