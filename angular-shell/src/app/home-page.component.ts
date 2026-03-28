import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RemoteCatalogService } from './remote-catalog.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero">
      <p class="eyebrow">Angular Federation Host</p>
      <h1>Dynamic shell for FS64 micro frontends</h1>
      <p class="lede">
        This host discovers remotes from a manifest, registers them at runtime, and keeps feature
        UIs focused on domain slices instead of shell wiring.
      </p>
    </section>

    <section class="remote-grid">
      @for (remote of catalog.remotes(); track remote.id) {
        <article class="remote-card">
          <div class="card-copy">
            <p class="card-kicker">{{ remote.remoteName }}</p>
            <h2>{{ remote.name }}</h2>
            <p>{{ remote.description || 'Angular micro frontend loaded through dynamic federation.' }}</p>
          </div>

          <div class="card-meta">
            <span>{{ remote.route }}</span>
            <a [routerLink]="remote.routePath">Open</a>
          </div>
        </article>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  protected readonly catalog = inject(RemoteCatalogService);
}
