import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { App } from './app/app';

const TAG_NAME = 'fs64-games-widget';

class Fs64GamesElement extends HTMLElement {
  static get observedAttributes() {
    return ['query'];
  }

  private root: Root | null = null;

  connectedCallback() {
    this.renderReactTree();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }

  attributeChangedCallback() {
    this.renderReactTree();
  }

  private renderReactTree() {
    if (!this.root) {
      this.root = createRoot(this);
    }

    const query = this.getAttribute('query') || '';
    const initialPath = query ? `/?q=${encodeURIComponent(query)}` : '/';

    this.root.render(
      <React.StrictMode>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </React.StrictMode>
    );
  }
}

export function defineFs64GamesElement(tagName = TAG_NAME): void {
  if (customElements.get(tagName)) return;
  customElements.define(tagName, Fs64GamesElement);
}
