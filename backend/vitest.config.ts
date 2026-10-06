import { defineConfig } from 'vitest/config';

// API-Tests: Der echte Server laeuft als eigener Prozess gegen eine
// Wegwerf-Datenbank (siehe tests/setup/server.ts). Alle Testdateien teilen
// sich diesen Server, deshalb laufen die Dateien nacheinander.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/setup/server.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
