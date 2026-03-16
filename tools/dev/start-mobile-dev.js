const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const isWindows = process.platform === 'win32';
const shell = isWindows;
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const child = spawn(npmCmd, ['run', 'dev:mobile:expo'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell,
  env: {
    ...process.env,
    FORCE_COLOR: '1',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[mobile] exited via signal ${signal}`);
    return;
  }
  if (typeof code === 'number' && code !== 0) {
    console.log(`[mobile] exited with code ${code}`);
  }
});
