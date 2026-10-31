#!/usr/bin/env node
/**
 * NAGARWATCH / AREAWATCH — Unified Full-Stack Live Server
 * Starts both Python Flask (Backend) and React Vite (Frontend) concurrently
 * with full local network (0.0.0.0) accessibility and colored logging.
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

const BACKEND_PORT = parseInt(process.env.PORT || '5001', 10);
const FRONTEND_PORT = 3000;

// ─── Discover Local Network IP ───────────────────────────────────────────────
function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const networkIp = getNetworkIp();

// ─── Free Port if Lingering ──────────────────────────────────────────────────
function freePortIfInUse(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`).toString();
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid) && pid !== '0') {
          execSync(`taskkill /F /PID ${pid} 2>nul`);
        }
      }
    } else {
      // macOS / Linux
      const pids = execSync(`lsof -ti :${port} 2>/dev/null || true`).toString().trim();
      if (pids) {
        const pidList = pids.split(/\s+/).filter(Boolean);
        for (const pid of pidList) {
          if (pid !== String(process.pid)) {
            process.kill(parseInt(pid, 10), 'SIGTERM');
          }
        }
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

// ─── Display Startup Banner ──────────────────────────────────────────────────
console.log('\x1b[1m\x1b[34m%s\x1b[0m', '┌─────────────────────────────────────────────────────────────────┐');
console.log('\x1b[1m\x1b[36m%s\x1b[0m', '│       NAGARWATCH / AREAWATCH — FULLSTACK DEVELOPMENT SERVER     │');
console.log('\x1b[1m\x1b[34m%s\x1b[0m', '└─────────────────────────────────────────────────────────────────┘');
console.log(`  \x1b[1m\x1b[35m[FRONTEND]\x1b[0m  React + Vite (Network enabled)`);
console.log(`    ➜  Local:    \x1b[32mhttp://localhost:${FRONTEND_PORT}\x1b[0m`);
console.log(`    ➜  Network:  \x1b[32mhttp://${networkIp}:${FRONTEND_PORT}\x1b[0m`);
console.log(`  \x1b[1m\x1b[36m[BACKEND]\x1b[0m   Flask REST API (Network enabled)`);
console.log(`    ➜  Local:    \x1b[33mhttp://localhost:${BACKEND_PORT}\x1b[0m`);
console.log(`    ➜  Network:  \x1b[33mhttp://${networkIp}:${BACKEND_PORT}\x1b[0m`);
console.log('\x1b[1m\x1b[34m%s\x1b[0m\n', '─────────────────────────────────────────────────────────────────');

// ─── Find Python Binary ──────────────────────────────────────────────────────
function getPythonCommand() {
  const candidates = [
    path.join(backendDir, 'venv', 'bin', 'python3'),
    path.join(backendDir, 'venv', 'bin', 'python'),
    path.join(backendDir, '.venv', 'bin', 'python3'),
    path.join(backendDir, '.venv', 'bin', 'python'),
    path.join(backendDir, 'venv', 'Scripts', 'python.exe'),
    path.join(backendDir, '.venv', 'Scripts', 'python.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

const pythonCmd = getPythonCommand();

// ─── Format Colored Streaming Output ─────────────────────────────────────────
function pipeWithPrefix(stream, prefix, ansiColor) {
  let remainder = '';
  stream.on('data', (chunk) => {
    remainder += chunk.toString();
    const lines = remainder.split('\n');
    remainder = lines.pop() || '';
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`\x1b[${ansiColor}m[${prefix}]\x1b[0m ${line}`);
      }
    }
  });
  stream.on('end', () => {
    if (remainder.trim().length > 0) {
      console.log(`\x1b[${ansiColor}m[${prefix}]\x1b[0m ${remainder}`);
    }
  });
}

// ─── Launch Processes ────────────────────────────────────────────────────────
freePortIfInUse(BACKEND_PORT);
freePortIfInUse(FRONTEND_PORT);

// Wait briefly for ports to release
await new Promise((r) => setTimeout(r, 400));

// Start Backend
const backendProcess = spawn(pythonCmd, ['app.py'], {
  cwd: backendDir,
  env: {
    ...process.env,
    PORT: String(BACKEND_PORT),
    PYTHONUNBUFFERED: '1',
    FLASK_ENV: 'development',
    FLASK_DEBUG: 'True',
  },
  stdio: ['inherit', 'pipe', 'pipe'],
});

pipeWithPrefix(backendProcess.stdout, 'BACKEND', '36'); // Cyan
pipeWithPrefix(backendProcess.stderr, 'BACKEND', '36');

backendProcess.on('error', (err) => {
  console.error('\x1b[31m[BACKEND FATAL]\x1b[0m', err.message);
});

// Start Frontend
const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const frontendProcess = spawn(
  npxCmd,
  ['vite', '--port', String(FRONTEND_PORT), '--host', '0.0.0.0'],
  {
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: String(FRONTEND_PORT),
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  }
);

pipeWithPrefix(frontendProcess.stdout, 'FRONTEND', '35'); // Magenta
pipeWithPrefix(frontendProcess.stderr, 'FRONTEND', '35');

frontendProcess.on('error', (err) => {
  console.error('\x1b[31m[FRONTEND FATAL]\x1b[0m', err.message);
});

// ─── Process Lifecycle & Graceful Shutdown ───────────────────────────────────
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n\x1b[33mShutting down NagarWatch / AreaWatch servers...\x1b[0m');

  try {
    backendProcess.kill('SIGINT');
  } catch {}
  try {
    frontendProcess.kill('SIGINT');
  } catch {}

  setTimeout(() => {
    try {
      backendProcess.kill('SIGKILL');
    } catch {}
    try {
      frontendProcess.kill('SIGKILL');
    } catch {}
    process.exit(0);
  }, 800);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

