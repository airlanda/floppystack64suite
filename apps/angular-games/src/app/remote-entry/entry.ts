import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { Fs64GamesDataService, Fs64GamesSearchResponse } from '@fs64/angular-data';

@Component({
  selector: 'app-angular-games-entry',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page-shell">
      <header class="page-header">
        <div>
          <p class="eyebrow">Angular Games MFE</p>
          <h1>Game finder</h1>
          <p class="lede">
            Live game search backed by the existing /api/games/search endpoint and remote metadata.
          </p>
        </div>
      </header>

      <form class="search-panel" (ngSubmit)="search()">
        <label class="field">
          <span>Search</span>
          <input
            type="search"
            name="query"
            [(ngModel)]="query"
            placeholder="Summer Games, Impossible Mission, Zak McKracken..."
          />
        </label>

        <button type="submit">Search</button>
      </form>

      <section class="results-summary">
        <p>{{ results().returned }} results shown</p>
        <p>{{ results().total }} total matches</p>
      </section>

      @if (errorMessage()) {
        <p class="error-banner">{{ errorMessage() }}</p>
      }

      @if (isLoading()) {
        <div class="loading-state">Searching game catalog...</div>
      } @else {
        <section class="results-grid">
          @for (result of results().results; track result.key) {
            <article class="result-card">
              <div class="result-copy">
                <p class="result-kicker">{{ result.metadata?.genre || 'Game metadata' }}</p>
                <h2>{{ result.metadata?.canonicalTitle || result.gameName }}</h2>
                <p>{{ result.metadata?.description || 'No stored description yet for this title.' }}</p>
              </div>

              <dl class="result-meta">
                <div>
                  <dt>Year</dt>
                  <dd>{{ result.metadata?.year || 'Unknown' }}</dd>
                </div>
                <div>
                  <dt>Developer</dt>
                  <dd>{{ result.metadata?.developer || 'Unknown' }}</dd>
                </div>
                <div>
                  <dt>Locations</dt>
                  <dd>{{ result.locations.length }}</dd>
                </div>
              </dl>

              <ul class="location-list">
                @for (location of result.locations; track location.diskId + location.side + location.slot) {
                  <li>
                    Disk {{ location.diskId }} | Side {{ location.sideLabel }} | Slot {{ location.slot }}
                    @if (location.rating !== null && location.rating !== undefined) {
                      <strong>{{ location.rating }}*</strong>
                    }
                  </li>
                }
              </ul>
            </article>
          }
        </section>
      }
    </section>
  `,
  styleUrl: './entry.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoteEntry {
  private readonly gamesService = inject(Fs64GamesDataService);

  protected query = '';
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly results = signal<Fs64GamesSearchResponse>({
    dataset: 'default',
    q: '',
    total: 0,
    returned: 0,
    results: [],
  });

  constructor() {
    void this.search();
  }

  async search(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const response = await firstValueFrom(this.gamesService.search({ q: this.query, limit: 24 }));
      this.results.set(response);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to search games.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
