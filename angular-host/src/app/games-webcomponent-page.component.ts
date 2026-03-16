import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { FederationLoaderService } from './federation-loader.service';

type GamesElementModule = {
  defineFs64GamesElement: (tagName?: string) => void;
};

@Component({
  selector: 'app-games-webcomponent-page',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <section class="interop-page">
      <header class="interop-header">
        <p class="interop-kicker">Angular Host</p>
        <h2>Games via Web Component</h2>
        <p>The Angular page resolves the remote from the manifest, registers the custom element, and renders it like any other DOM element.</p>
      </header>

      <fs64-games-widget class="interop-surface"></fs64-games-widget>
    </section>
  `,
})
export class GamesWebcomponentPageComponent implements AfterViewInit {
  private readonly loader = inject(FederationLoaderService);

  async ngAfterViewInit() {
    const module = await this.loader.loadRemoteById<GamesElementModule>('games', './WebComponent');
    module.defineFs64GamesElement();
  }
}
