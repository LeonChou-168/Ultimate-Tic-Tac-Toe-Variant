#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const subcommand = process.argv[2] ?? 'dev';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const commandMap = {
  dev: ['run', 'dev'],
  server: ['run', 'server:dev'],
  test: ['test'],
  build: ['run', 'build'],
};

function printHelp() {
  process.stdout.write(`Ultimate Tic-Tac-Toe Variant CLI

Usage:
  uttv              Start the Vite dev server
  uttv dev          Start the Vite dev server
  uttv server       Start the multiplayer socket server
  uttv test         Run Vitest
  uttv build        Run the production build
  uttv help         Show this help message

Global setup:
  npm install
  npm link

Then you can run:
  uttv
`);
}

if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
  printHelp();
  process.exit(0);
}

const args = commandMap[subcommand];

if (!args) {
  process.stderr.write(`Unknown command: ${subcommand}\n\n`);
  printHelp();
  process.exit(1);
}

const child = spawn(npmCommand, args, {
  cwd: projectRoot,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
