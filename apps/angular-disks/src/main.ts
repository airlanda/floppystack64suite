export {
  bootstrapAngularDisksStandalone,
  mountAngularDisks,
  unmountAngularDisks,
} from './bootstrap';

import {
  bootstrapAngularDisksStandalone,
  mountAngularDisks,
  unmountAngularDisks,
} from './bootstrap';

declare global {
  interface Window {
    mountAngularDisks?: typeof mountAngularDisks;
    unmountAngularDisks?: typeof unmountAngularDisks;
  }
}

window.mountAngularDisks = mountAngularDisks;
window.unmountAngularDisks = unmountAngularDisks;

if (document.querySelector('app-angular-disks-entry')) {
  bootstrapAngularDisksStandalone().catch((err) => console.error(err));
}
