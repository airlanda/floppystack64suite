import { Route } from '@angular/router';

import { Fs64ResolvedAngularRemoteManifestEntry } from '@fs64/angular-data';

import { HomePageComponent } from './home-page.component';
import { RemoteModulePageComponent } from './remote-module-page.component';

export function buildAppRoutes(remotes: Fs64ResolvedAngularRemoteManifestEntry[]): Route[] {
  return [
    {
      path: '',
      component: HomePageComponent,
      pathMatch: 'full',
    },
    ...remotes.map(
      (remote): Route => ({
        path: remote.routePath,
        component: RemoteModulePageComponent,
        data: {
          remote,
        },
      })
    ),
    {
      path: '**',
      redirectTo: '',
    },
  ];
}
