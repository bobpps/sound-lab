import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--import', 'tsx'],
      },
    },
  },
});
