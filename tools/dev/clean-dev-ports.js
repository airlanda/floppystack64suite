const { execSync } = require('child_process');

const PORTS = [5000, 4200, 4201, 4202, 4203, 4300];

for (const port of PORTS) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const pids = new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s+/).pop())
        .filter((value) => value && /^\d+$/.test(value))
    );

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
        console.log(`Killed PID ${pid} on port ${port}`);
      } catch {
        console.log(`Failed to kill PID ${pid} on port ${port}`);
      }
    }
  } catch {
    console.log(`Port ${port} is clear`);
  }
}

