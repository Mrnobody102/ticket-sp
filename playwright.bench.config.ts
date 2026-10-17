import { defineConfig } from '@playwright/test';

export default defineConfig({ testDir: './tests/benchmark', timeout: 120000, workers: 1, fullyParallel: false, reporter: 'list' });
