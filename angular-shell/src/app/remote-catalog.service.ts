import { Injectable, signal } from '@angular/core';

import {
  Fs64AngularManifestService,
  Fs64ResolvedAngularRemoteManifestEntry,
} from '@fs64/angular-data';

@Injectable({ providedIn: 'root' })
export class RemoteCatalogService {
  readonly remotes = signal<Fs64ResolvedAngularRemoteManifestEntry[]>([]);

  constructor(private readonly manifestService: Fs64AngularManifestService) {}

  async initialize(): Promise<Fs64ResolvedAngularRemoteManifestEntry[]> {
    const remotes = await this.manifestService.load();
    this.remotes.set(remotes);
    return remotes;
  }
}
