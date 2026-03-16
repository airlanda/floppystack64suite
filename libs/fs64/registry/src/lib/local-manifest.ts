import { Fs64RemoteManifest } from './manifest';

// Local manifest is the first step toward runtime federation. The host consumes this
// contract now, and a later pass can swap the source from static TS to fetched JSON.
export const FS64_LOCAL_REMOTE_MANIFEST: Fs64RemoteManifest = {
  remotes: [
    {
      id: 'disks',
      name: 'Disks',
      entry: 'http://localhost:4201/remoteEntry.js',
      route: '/disks',
      icon: 'disk',
      order: 10,
      category: 'library',
      description: 'Disk inventory, ratings, editing, and metadata.',
    },
    {
      id: 'games',
      name: 'Games',
      entry: 'http://localhost:4202/remoteEntry.js',
      route: '/games',
      icon: 'games',
      order: 20,
      category: 'library',
      description: 'Game search and metadata-driven browsing.',
    },
  ],
};
