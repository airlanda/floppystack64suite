import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { App } from './app/app';

type MountOptions = {
  initialPath?: string;
};

const roots = new WeakMap<Element, Root>();

// Angular uses an imperative bridge so it can mount the React tree into a host element.
export function mountFs64DisksBridge(element: Element, options?: MountOptions): void {
  const existingRoot = roots.get(element);
  if (existingRoot) {
    existingRoot.unmount();
  }

  const root = createRoot(element);
  roots.set(element, root);
  root.render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[options?.initialPath || '/']}>
        <App />
      </MemoryRouter>
    </React.StrictMode>
  );
}

export function unmountFs64DisksBridge(element: Element): void {
  const root = roots.get(element);
  if (!root) return;
  root.unmount();
  roots.delete(element);
}
