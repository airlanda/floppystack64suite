import { provideHttpClient } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, Router, withHashLocation } from '@angular/router';

import { buildAppRoutes } from './app.routes';
import { RemoteCatalogService } from './remote-catalog.service';

function initializeRemoteCatalog(remoteCatalog: RemoteCatalogService, router: Router) {
  return async () => {
    const remotes = await remoteCatalog.initialize();
    router.resetConfig(buildAppRoutes(remotes));
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(buildAppRoutes([]), withHashLocation()),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeRemoteCatalog,
      deps: [RemoteCatalogService, Router],
    },
  ]
};
