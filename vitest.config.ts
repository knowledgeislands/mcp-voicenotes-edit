import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    env: {
      // Bogus PAT so config.ts boot validation passes when tests instantiate
      // the server entrypoint. Real-API tests live in `src/**/*.live.test.ts`
      // and require MCP_VOICENOTES_EDIT_PAT_TEST to be set externally.
      MCP_VOICENOTES_EDIT_PAT: 'test|placeholder'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        // Server entry points and tool registration aggregators are pure
        // wiring (every line is `server.registerTool(...)`); their behaviour
        // is exercised by `bun run server:mcp:inspect` and smoke tests.
        'src/mcp-server/index.ts',
        'src/tools/**/index.ts',
        // Pure data: annotation presets are referenced only from tool
        // registration sites (which are themselves excluded).
        'src/utils/annotations.ts'
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
})
