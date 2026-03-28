import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  Fs64MountedRemote,
  Fs64ResolvedAngularRemoteManifestEntry,
} from '@fs64/angular-data';

type Fs64RemoteMountFn = (hostElement: Element) => Promise<Fs64MountedRemote> | Fs64MountedRemote;
type Fs64RemoteGlobalScope = Window &
  typeof globalThis & {
    [key: string]: unknown;
  };

const loadedRemoteAssets = new Map<string, Promise<void>>();

function loadScriptAsset(scriptUrl: string, moduleType = false): Promise<void> {
  const existingPromise = loadedRemoteAssets.get(scriptUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const scriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[data-fs64-asset="${scriptUrl}"]`
    ) as HTMLScriptElement | null;

    if (existingScript?.dataset['loaded'] === 'true') {
      resolve();
      return;
    }

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error(`Failed to load ${scriptUrl}.`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.type = moduleType ? 'module' : 'text/javascript';
    script.crossOrigin = 'anonymous';
    script.dataset['fs64Asset'] = scriptUrl;
    script.addEventListener(
      'load',
      () => {
        script.dataset['loaded'] = 'true';
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => reject(new Error(`Failed to load ${scriptUrl}.`)),
      { once: true }
    );
    document.head.appendChild(script);
  });

  loadedRemoteAssets.set(scriptUrl, scriptPromise);
  return scriptPromise;
}

function loadStyleAsset(styleUrl: string): Promise<void> {
  const existingPromise = loadedRemoteAssets.get(styleUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const stylePromise = new Promise<void>((resolve, reject) => {
    const existingLink = document.querySelector(
      `link[data-fs64-asset="${styleUrl}"]`
    ) as HTMLLinkElement | null;

    if (existingLink) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = styleUrl;
    link.crossOrigin = 'anonymous';
    link.dataset['fs64Asset'] = styleUrl;
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error(`Failed to load ${styleUrl}.`)), {
      once: true,
    });
    document.head.appendChild(link);
  });

  loadedRemoteAssets.set(styleUrl, stylePromise);
  return stylePromise;
}

async function loadRemoteHtmlEntry(remoteEntry: string): Promise<void> {
  const response = await fetch(remoteEntry, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${remoteEntry}.`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(html, 'text/html');

  const styles = Array.from(documentFragment.querySelectorAll('link[rel="stylesheet"][href]')).map((link) =>
    new URL(link.getAttribute('href') || '', remoteEntry).toString()
  );
  const scripts = Array.from(documentFragment.querySelectorAll('script[src]')).map((script) => ({
    url: new URL(script.getAttribute('src') || '', remoteEntry).toString(),
    moduleType: script.getAttribute('type') === 'module',
  }));

  await Promise.all(styles.map((styleUrl) => loadStyleAsset(styleUrl)));
  for (const script of scripts) {
    await loadScriptAsset(script.url, script.moduleType);
  }
}

async function loadRemoteEntry(remoteEntry: string): Promise<void> {
  if (remoteEntry.endsWith('.js')) {
    await loadScriptAsset(remoteEntry, true);
    return;
  }

  await loadRemoteHtmlEntry(remoteEntry);
}

@Component({
  selector: 'app-remote-module-page',
  standalone: true,
  template: `
    <section class="remote-shell">
      <header class="remote-header">
        <div>
          <p class="eyebrow">{{ remote()?.remoteName }}</p>
          <h1>{{ remote()?.name }}</h1>
          <p class="lede">{{ remote()?.description || 'Angular micro frontend loaded dynamically at runtime.' }}</p>
        </div>
      </header>

      @if (errorMessage()) {
        <p class="error-banner">{{ errorMessage() }}</p>
      }

      @if (isLoading()) {
        <div class="loading-state">Loading {{ remote()?.name || 'remote app' }}...</div>
      }

      <section class="remote-surface" #mountPoint></section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoteModulePageComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly globalScope = window as unknown as Fs64RemoteGlobalScope;

  @ViewChild('mountPoint', { static: true })
  private readonly mountPoint!: ElementRef<HTMLElement>;

  protected readonly remote = computed(
    () => this.route.snapshot.data['remote'] as Fs64ResolvedAngularRemoteManifestEntry | undefined
  );
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');

  private mountedRemote: Fs64MountedRemote | null = null;

  async ngAfterViewInit(): Promise<void> {
    const remote = this.remote();
    if (!remote) {
      this.errorMessage.set('Remote metadata is missing.');
      this.isLoading.set(false);
      return;
    }

    try {
      await loadRemoteEntry(remote.remoteEntry);
      const mountFn = this.globalScope[remote.exposedModule];

      if (typeof mountFn !== 'function') {
        throw new Error(`Remote "${remote.name}" does not export "${remote.exposedModule}".`);
      }

      this.mountedRemote = await (mountFn as Fs64RemoteMountFn)(this.mountPoint.nativeElement);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to load remote.');
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.mountedRemote?.destroy();
    this.mountedRemote = null;
  }
}
