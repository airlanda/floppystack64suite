import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Fs64ThemeName, getFs64Theme, readStoredFs64Theme, writeStoredFs64Theme } from '@fs64/theme';
import { Fs64Shell } from '@fs64/ui';
import {
  fetchFs64RemoteManifest,
  Fs64ResolvedRemoteManifestEntry,
  loadFs64RemoteModule,
} from '@fs64/registry';

const FS64_REMOTE_MANIFEST_URLS = ['http://localhost:5000/api/mfe/manifest', '/assets/fs64-remotes.json'];

function createRemoteComponent(remote: Fs64ResolvedRemoteManifestEntry) {
  return React.lazy(async () => {
    const module = await loadFs64RemoteModule<{ default?: React.ComponentType }>(remote);
    return { default: module.default ?? (() => <div>Remote "{remote.name}" does not expose a default component.</div>) };
  });
}

async function loadRemoteRegistry(): Promise<Fs64ResolvedRemoteManifestEntry[]> {
  let lastError: unknown = null;

  for (const url of FS64_REMOTE_MANIFEST_URLS) {
    try {
      return await fetchFs64RemoteManifest(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to load the FS64 remote manifest.');
}

export function App() {
  const [themeName, setThemeName] = React.useState<Fs64ThemeName>(() => readStoredFs64Theme());
  const [resolvedRemotes, setResolvedRemotes] = React.useState<Fs64ResolvedRemoteManifestEntry[]>([]);
  const [manifestError, setManifestError] = React.useState<string | null>(null);
  const theme = React.useMemo(() => getFs64Theme(themeName), [themeName]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeName);
  }, [themeName]);

  React.useEffect(() => {
    let cancelled = false;

    loadRemoteRegistry()
      .then((remotes) => {
        if (cancelled) return;
        setResolvedRemotes(remotes);
        setManifestError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setManifestError(error instanceof Error ? error.message : 'Failed to load the FS64 remote manifest.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = React.useMemo(
    () => resolvedRemotes.map((remote) => ({ id: remote.id, label: remote.name, route: remote.route, icon: remote.icon })),
    [resolvedRemotes]
  );
  const defaultRoute = navItems[0]?.route ?? '/';
  const remoteComponentMap = React.useMemo(
    () =>
      Object.fromEntries(resolvedRemotes.map((remote) => [remote.id, createRemoteComponent(remote)])) as Record<
        string,
        React.LazyExoticComponent<React.ComponentType>
      >,
    [resolvedRemotes]
  );

  const handleThemeChange = React.useCallback((nextTheme: Fs64ThemeName) => {
    setThemeName(nextTheme);
    writeStoredFs64Theme(nextTheme);
  }, []);

  return (
    <React.Suspense fallback={<div style={{ padding: '2rem' }}>Loading FS64...</div>}>
      <Fs64Shell theme={theme} themeName={themeName} onThemeChange={handleThemeChange} navItems={navItems}>
        {manifestError ? (
          <div style={{ padding: '1rem', border: `1px solid ${theme.border}`, background: theme.panel, borderRadius: 12 }}>
            {manifestError}
          </div>
        ) : resolvedRemotes.length === 0 ? (
          <div style={{ padding: '1rem' }}>Loading FS64 remote registry...</div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to={defaultRoute} replace />} />
            {resolvedRemotes.map((remote) => {
              const RemoteComponent = remoteComponentMap[remote.id];
              return <Route key={remote.id} path={`${remote.route}/*`} element={<RemoteComponent />} />;
            })}
          </Routes>
        )}
      </Fs64Shell>
    </React.Suspense>
  );
}

export default App;
