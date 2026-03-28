export {
  bootstrapAngularGamesStandalone,
  mountAngularGames,
  unmountAngularGames,
} from './bootstrap';

import {
  bootstrapAngularGamesStandalone,
  mountAngularGames,
  unmountAngularGames,
} from './bootstrap';

declare global {
  interface Window {
    mountAngularGames?: typeof mountAngularGames;
    unmountAngularGames?: typeof unmountAngularGames;
  }
}

window.mountAngularGames = mountAngularGames;
window.unmountAngularGames = unmountAngularGames;

if (document.querySelector('app-angular-games-entry')) {
  bootstrapAngularGamesStandalone().catch((err) => console.error(err));
}
