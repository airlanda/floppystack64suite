import { Route } from '@angular/router';

export const remoteRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./entry').then((module) => module.RemoteEntry),
  },
];
