import { createComponent } from '@angular/core';
import { bootstrapApplication, createApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RemoteEntry } from './app/remote-entry/entry';

let mountedRemote:
  | {
      destroy: () => void;
    }
  | null = null;

export async function mountAngularDisks(hostElement: Element) {
  mountedRemote?.destroy();
  hostElement.innerHTML = '';

  const appRef = await createApplication(appConfig);
  const componentRef = createComponent(RemoteEntry, {
    environmentInjector: appRef.injector,
    hostElement,
  });

  appRef.attachView(componentRef.hostView);

  mountedRemote = {
    destroy: () => {
      appRef.detachView(componentRef.hostView);
      componentRef.destroy();
      appRef.destroy();
      hostElement.innerHTML = '';
    },
  };

  return mountedRemote;
}

export function unmountAngularDisks() {
  mountedRemote?.destroy();
  mountedRemote = null;
}

export async function bootstrapAngularDisksStandalone() {
  return bootstrapApplication(RemoteEntry, appConfig);
}
