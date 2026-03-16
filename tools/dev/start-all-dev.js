const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const isWindows = process.platform === 'win32';
const shell = isWindows;
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function startProcess(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited via signal ${signal}`);
      return;
    }
    if (typeof code === 'number' && code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

const children = [
  startProcess('backend', npmCmd, ['run', 'dev:backend'], rootDir),
  startProcess('frontend', npmCmd, ['run', 'dev:all'], rootDir),
];

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
