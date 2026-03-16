const { spawnSync, spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

function runStep(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runStep('npm', ['run', 'build:web-legacy']);

const backend = spawn('npm', ['run', 'start:backend:static'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

backend.on('exit', (code) => {
  process.exit(code ?? 0);
});
