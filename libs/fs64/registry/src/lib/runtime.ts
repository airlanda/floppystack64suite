import { Fs64RemoteContainer, Fs64ResolvedRemoteManifestEntry } from './manifest';

declare const __webpack_init_sharing__: ((scope: string) => Promise<void>) | undefined;
declare const __webpack_share_scopes__: { default?: unknown } | undefined;

declare global {
  interface Window {
    [key: string]: unknown;
  }
}

const remoteEntryLoads = new Map<string, Promise<void>>();
const initializedContainers = new Set<string>();

function getContainer(scope: string): Fs64RemoteContainer | null {
  const candidate = window[scope];
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const container = candidate as Partial<Fs64RemoteContainer>;
  if (typeof container.get !== 'function' || typeof container.init !== 'function') {
    return null;
  }

  return container as Fs64RemoteContainer;
}

function loadRemoteEntry(remote: Fs64ResolvedRemoteManifestEntry): Promise<void> {
  const existingLoad = remoteEntryLoads.get(remote.scope);
  if (existingLoad) {
    return existingLoad;
  }

  const alreadyLoaded = getContainer(remote.scope);
  if (alreadyLoaded) {
    const settled = Promise.resolve();
    remoteEntryLoads.set(remote.scope, settled);
    return settled;
  }

  const pending = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[data-fs64-remote="${remote.scope}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error(`Failed to load remote entry for ${remote.name}.`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = remote.entry;
    script.type = 'text/javascript';
    script.async = true;
    script.dataset['fs64Remote'] = remote.scope;
    script.onload = () => {
      if (getContainer(remote.scope)) {
        resolve();
        return;
      }
      reject(new Error(`Remote entry for ${remote.name} loaded, but scope "${remote.scope}" was not registered on window.`));
    };
    script.onerror = () => reject(new Error(`Failed to load remote entry for ${remote.name} from ${remote.entry}.`));
    document.head.appendChild(script);
  });

  remoteEntryLoads.set(remote.scope, pending);
  return pending;
}

function getShareScope(): unknown {
  return __webpack_share_scopes__?.default ?? {};
}

async function tryInitHostShareScope(): Promise<void> {
  if (typeof __webpack_init_sharing__ !== 'function') {
    return;
  }

  try {
    await __webpack_init_sharing__('default');
  } catch {
    // Angular is only acting as an interop host in this experiment. If the host
    // runtime exposes a partial federation hook, continue with an empty share scope.
  }
}

export async function loadFs64RemoteModule<T = unknown>(remote: Fs64ResolvedRemoteManifestEntry): Promise<T> {
  await tryInitHostShareScope();
  await loadRemoteEntry(remote);

  const container = getContainer(remote.scope);
  if (!container) {
    throw new Error(`Remote scope "${remote.scope}" is not available after loading ${remote.entry}.`);
  }

  if (!initializedContainers.has(remote.scope)) {
    await container.init(getShareScope());
    initializedContainers.add(remote.scope);
  }

  const factory = await container.get(remote.exposedModule);
  return factory() as T;
}
