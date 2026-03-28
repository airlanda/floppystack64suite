import { Route } from '@angular/router';
import { DisksBridgePageComponent } from './disks-bridge-page.component';
import { GamesWebcomponentPageComponent } from './games-webcomponent-page.component';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'disks-bridge',
  },
  {
    path: 'disks-bridge',
    component: DisksBridgePageComponent,
  },
  {
    path: 'games-webcomponent',
    component: GamesWebcomponentPageComponent,
  },
];
