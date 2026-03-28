import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Fs64DisksDataService, Fs64DiskRecord, Fs64DiskStore } from '@fs64/angular-data';

function normalizeGameName(game: string | { gameName?: string } | null | undefined): string {
  if (!game) {
    return '';
  }

  return typeof game === 'string' ? game : String(game.gameName || '').trim();
}

function getGameRating(game: string | { rating?: number | null } | null | undefined): number | null {
  if (!game || typeof game === 'string') {
    return null;
  }

  return typeof game.rating === 'number' ? game.rating : null;
}

type DiskSortMode = 'label' | 'games-desc' | 'games-asc';

@Component({
  selector: 'app-angular-disks-entry',
  standalone: true,
  template: `
    <section class="page-shell">
      <header class="page-header">
        <div>
          <p class="eyebrow">Angular Disks MFE</p>
          <h1>Disk inventory</h1>
          <p class="lede">
            This remote uses the existing disk and store APIs and stays independent from the shell.
          </p>
        </div>

        <button type="button" class="refresh-button" (click)="refresh()">
          Refresh
        </button>
      </header>

      <section class="toolbar">
        <label class="field">
          <span>Dataset</span>
          <select [value]="selectedDataset()" (change)="setDataset($any($event.target).value)">
            <option value="">Active stores (merged)</option>
            @for (store of stores(); track store.key) {
              <option [value]="store.key">{{ store.name }}</option>
            }
          </select>
        </label>

        <label class="field search">
          <span>Filter</span>
          <input
            type="search"
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            placeholder="Search disks or games"
          />
        </label>

        <label class="field">
          <span>Sort</span>
          <select [value]="sortMode()" (change)="sortMode.set($any($event.target).value)">
            <option value="label">Label</option>
            <option value="games-desc">Most games</option>
            <option value="games-asc">Fewest games</option>
          </select>
        </label>
      </section>

      <section class="summary-grid">
        <article>
          <span>Stores</span>
          <strong>{{ stores().length }}</strong>
        </article>
        <article>
          <span>Visible disks</span>
          <strong>{{ filteredDisks().length }}</strong>
        </article>
        <article>
          <span>Total games</span>
          <strong>{{ totalVisibleGames() }}</strong>
        </article>
      </section>

      <section class="store-grid">
        @for (store of stores(); track store.key) {
          <article class="store-card" [class.active]="isStoreActive(store.key)">
            <div>
              <p class="store-kicker">{{ store.key }}</p>
              <h2>{{ store.name }}</h2>
              <p>{{ store.diskCount || 0 }} disks available in this dataset.</p>
            </div>

            <div class="store-actions">
              <button type="button" class="secondary-button" (click)="focusStore(store.key)">
                View
              </button>
              <button type="button" class="secondary-button" (click)="toggleStoreActive(store.key)">
                {{ isStoreActive(store.key) ? 'Disable' : 'Enable' }}
              </button>
            </div>
          </article>
        }
      </section>

      @if (errorMessage()) {
        <p class="error-banner">{{ errorMessage() }}</p>
      }

      @if (isLoading()) {
        <div class="loading-state">Loading disk inventory...</div>
      } @else {
        <section class="disk-grid">
          @for (disk of filteredDisks(); track disk._id) {
            <article class="disk-card" [class.selected]="selectedDiskId() === disk._id">
              <header class="disk-card-header">
                <div>
                  <p class="disk-label">{{ disk.label || ('Disk ' + disk._id) }}</p>
                  <p class="disk-meta">
                    {{ disk['datasetName'] || disk.datasetKey || 'merged dataset' }} |
                    {{ diskGameCount(disk) }} games
                  </p>
                </div>

                <button type="button" class="secondary-button" (click)="selectDisk(disk)">
                  {{ selectedDiskId() === disk._id ? 'Selected' : 'Inspect' }}
                </button>
              </header>

              <div class="disk-sides">
                <section>
                  <h2>Side A</h2>
                  <ul>
                    @for (game of disk.sideA || []; track gameTrack(game, $index)) {
                      <li>
                        <span>{{ displayGameName(game) }}</span>
                        @if (displayRating(game) !== null) {
                          <small>{{ displayRating(game) }}*</small>
                        }
                      </li>
                    }
                  </ul>
                </section>

                <section>
                  <h2>Side B</h2>
                  <ul>
                    @for (game of disk.sideB || []; track gameTrack(game, $index)) {
                      <li>
                        <span>{{ displayGameName(game) }}</span>
                        @if (displayRating(game) !== null) {
                          <small>{{ displayRating(game) }}*</small>
                        }
                      </li>
                    }
                  </ul>
                </section>
              </div>
            </article>
          }
        </section>

        @if (selectedDisk(); as disk) {
          <aside class="detail-panel">
            <div class="detail-header">
              <div>
                <p class="eyebrow">Selected disk</p>
                <h2>{{ disk.label || ('Disk ' + disk._id) }}</h2>
              </div>
              <button type="button" class="secondary-button" (click)="clearSelection()">Close</button>
            </div>

            <div class="detail-stats">
              <article>
                <span>Dataset</span>
                <strong>{{ disk['datasetName'] || disk.datasetKey || 'merged dataset' }}</strong>
              </article>
              <article>
                <span>Side A</span>
                <strong>{{ disk.sideA?.length || 0 }}</strong>
              </article>
              <article>
                <span>Side B</span>
                <strong>{{ disk.sideB?.length || 0 }}</strong>
              </article>
            </div>

            <section class="detail-list">
              <h3>Combined game list</h3>
              <ul>
                @for (game of combinedGames(disk); track gameTrack(game, $index)) {
                  <li>
                    <span>{{ displayGameName(game) }}</span>
                    @if (displayRating(game) !== null) {
                      <small>{{ displayRating(game) }}*</small>
                    }
                  </li>
                }
              </ul>
            </section>
          </aside>
        }
      }
    </section>
  `,
  styleUrl: './entry.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoteEntry {
  private readonly disksService = inject(Fs64DisksDataService);

  readonly stores = signal<Fs64DiskStore[]>([]);
  readonly activeStoreKeys = signal<string[]>([]);
  readonly disks = signal<Fs64DiskRecord[]>([]);
  readonly selectedDataset = signal('');
  readonly searchTerm = signal('');
  readonly sortMode = signal<DiskSortMode>('label');
  readonly selectedDiskId = signal<string | null>(null);
  readonly isMutatingStores = signal(false);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly filteredDisks = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) {
      return this.disks();
    }

    const filtered = this.disks().filter((disk) => {
      const diskLabel = `${disk.label || ''} ${disk['datasetName'] || ''}`.toLowerCase();
      if (diskLabel.includes(query)) {
        return true;
      }

      const games = [...(disk.sideA || []), ...(disk.sideB || [])];
      return games.some((game) => normalizeGameName(game).toLowerCase().includes(query));
    });

    return filtered.sort((left, right) => this.compareDisks(left, right, this.sortMode()));
  });
  readonly totalVisibleGames = computed(() =>
    this.filteredDisks().reduce((total, disk) => total + this.diskGameCount(disk), 0)
  );
  readonly selectedDisk = computed(
    () => this.filteredDisks().find((disk) => disk._id === this.selectedDiskId()) ?? null
  );

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const [storesResponse, disks] = await Promise.all([
        firstValueFrom(this.disksService.getStores()),
        firstValueFrom(this.disksService.getDisks(this.selectedDataset() || undefined)),
      ]);

      this.stores.set(storesResponse.stores ?? []);
      this.activeStoreKeys.set(storesResponse.activeStoreKeys ?? []);
      this.disks.set(disks ?? []);
      if (!this.selectedDisk()) {
        this.selectedDiskId.set(disks[0]?._id ?? null);
      }
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to load disks.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async setDataset(dataset: string): Promise<void> {
    this.selectedDataset.set(dataset);
    await this.refresh();
  }

  async toggleStoreActive(storeKey: string): Promise<void> {
    if (this.isMutatingStores()) {
      return;
    }

    const current = new Set(this.activeStoreKeys());
    if (current.has(storeKey)) {
      current.delete(storeKey);
    } else {
      current.add(storeKey);
    }

    this.isMutatingStores.set(true);
    this.errorMessage.set('');

    try {
      const response = await firstValueFrom(this.disksService.setActiveStores(Array.from(current)));
      this.stores.set(response.stores ?? []);
      this.activeStoreKeys.set(response.activeStoreKeys ?? []);
      if (!this.selectedDataset()) {
        await this.refresh();
      }
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to update active stores.');
    } finally {
      this.isMutatingStores.set(false);
    }
  }

  protected focusStore(storeKey: string): void {
    void this.setDataset(storeKey);
  }

  protected isStoreActive(storeKey: string): boolean {
    return this.activeStoreKeys().includes(storeKey);
  }

  protected selectDisk(disk: Fs64DiskRecord): void {
    this.selectedDiskId.set(disk._id);
  }

  protected clearSelection(): void {
    this.selectedDiskId.set(null);
  }

  protected displayGameName(game: string | { gameName?: string } | null | undefined): string {
    return normalizeGameName(game) || 'Untitled game';
  }

  protected displayRating(game: string | { rating?: number | null } | null | undefined): number | null {
    return getGameRating(game);
  }

  protected diskGameCount(disk: Fs64DiskRecord): number {
    return (disk.sideA?.length || 0) + (disk.sideB?.length || 0);
  }

  protected combinedGames(disk: Fs64DiskRecord): Array<string | { gameName?: string; rating?: number | null }> {
    return [...(disk.sideA || []), ...(disk.sideB || [])];
  }

  protected gameTrack(game: string | { gameName?: string } | null | undefined, index: number): string {
    return `${this.displayGameName(game)}-${index}`;
  }

  private compareDisks(left: Fs64DiskRecord, right: Fs64DiskRecord, sortMode: DiskSortMode): number {
    const leftCount = this.diskGameCount(left);
    const rightCount = this.diskGameCount(right);

    if (sortMode === 'games-desc') {
      return rightCount - leftCount || this.diskLabel(left).localeCompare(this.diskLabel(right));
    }

    if (sortMode === 'games-asc') {
      return leftCount - rightCount || this.diskLabel(left).localeCompare(this.diskLabel(right));
    }

    return this.diskLabel(left).localeCompare(this.diskLabel(right));
  }

  private diskLabel(disk: Fs64DiskRecord): string {
    return String(disk.label || `Disk ${disk._id}`);
  }
}
