import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TestProject } from 'vitest/node';
import { ADMIN, PEOPLE, type Person } from '../fixtures';

// Startet den Server als eigenen Prozess gegen ein Wegwerf-Verzeichnis im
// Temp-Ordner. Produktivdaten werden dabei nie beruehrt.

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    tokens: Record<Person, string>;
  }
}

let child: ChildProcess | undefined;
let tmpDir: string | undefined;

async function waitForHealth(baseUrl: string, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      /* Server startet noch */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Test-Server ist nicht rechtzeitig gestartet');
}

export default async function setup(project: TestProject) {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kliqtape-test-'));
  const port = 40_000 + Math.floor(Math.random() * 10_000);
  const baseUrl = `http://127.0.0.1:${port}`;

  // Ein einziger Node-Prozess mit tsx-Loader (statt des tsx-Wrappers, der
  // einen zweiten Prozess startet) — so beendet teardown() den Server sicher.
  child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: path.join(tmpDir, 'data'),
      MEDIA_DIR: path.join(tmpDir, 'media'),
      ADMIN_NAME: ADMIN,
      RATE_LIMIT_PER_MIN: '100000',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  await waitForHealth(baseUrl);

  // Jede Testperson beansprucht einmal ihren Namen und bekommt ihren Token.
  const tokens = {} as Record<Person, string>;
  for (const [key, name] of Object.entries(PEOPLE) as [Person, string][]) {
    const res = await fetch(`${baseUrl}/api/auth/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.status !== 201) throw new Error(`Claim fuer ${name} fehlgeschlagen: ${res.status}`);
    tokens[key] = ((await res.json()) as { token: string }).token;
  }

  project.provide('baseUrl', baseUrl);
  project.provide('tokens', tokens);

  return teardown;
}

async function teardown() {
  if (child && child.exitCode === null) {
    const exited = new Promise<void>((resolve) => child!.once('exit', () => resolve()));
    child.kill('SIGTERM');
    const timer = setTimeout(() => child?.kill('SIGKILL'), 3_000);
    await exited;
    clearTimeout(timer);
  }
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}
