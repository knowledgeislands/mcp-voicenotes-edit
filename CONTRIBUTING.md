# Contributing

Thanks for your interest. This file covers the dev loop, conventions, and what to check before you open a PR.

## Setup

You'll need [Bun](https://bun.sh) 1.3+ for the dev loop, and Node.js 22+ to run the compiled `dist/` output the published package ships.

```bash
git clone https://github.com/knowledgeislands/mcp-voicenotes-edit.git
cd mcp-voicenotes-edit
bun install
```

`bun install` triggers `prepare` which configures the husky pre-commit hook — so every commit will auto-run `lint-staged` and format your changes.

## Dev loop

```bash
bun run server:mcp:dev      # bun --watch — runs the server from source
bun run server:mcp:inspect  # MCP Inspector against the TS source
bun run lint:types          # tsc --noEmit
bun run test                # vitest (use `bun run test`, not `bun test`)
bun run test:watch          # vitest in watch mode
bun run test:coverage       # vitest with v8 coverage report
bun run lint:check          # Biome lint + format check
bun run lint:fix            # Biome auto-fix
bun run lint:md             # prettier + markdownlint for *.md
```

You will need a Voicenotes personal access token in `MCP_VOICENOTES_EDIT_PAT` for any live-API testing — see [README.md](./README.md#1-extract-your-personal-access-token) for how to extract one. Unit tests do not need a real PAT; the HTTP client is exercised through `fetch` mocks.

## Conventions

### Code

- **TypeScript ES modules** — `"type": "module"`, internal imports use `.js` extensions (e.g. `from './voicenotes-client.js'`) so `tsc` emits valid JS.
- **Arrow functions** for top-level declarations (`export const foo = () => …`).
- **No bare `fetch`** in tool callbacks — go through `src/voicenotes-client.ts` so auth, encoding, and error translation stay centralised.
- **Input validation**: every uuid input carries the `^[A-Za-z0-9]{8}$` regex on the zod schema. Bounded tag arrays (≤ 64) and bounded title strings (≤ 500). New schemas must continue this.
- **Errors**: tools return MCP errors via `errorResult(...)`; structured results via `jsonResult(...)`. Never `throw` from a tool callback — the audit-log wrapper depends on the MCP `isError` envelope.
- **Annotations**: be honest with `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` on every tool registration. Use a preset from [src/utils/annotations.ts](./src/utils/annotations.ts).

### Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) so [release-please](https://github.com/googleapis/release-please) can derive version bumps and changelog entries automatically.

| Type        | What it means           | Bumps |
| ----------- | ----------------------- | ----- |
| `feat:`     | new feature             | minor |
| `fix:`      | bug fix                 | patch |
| `perf:`     | performance improvement | patch |
| `docs:`     | documentation only      | patch |
| `deps:`     | dependency change       | patch |
| `refactor:` | internal restructuring  | none  |
| `test:`     | test-only changes       | none  |
| `chore:`    | tooling, config         | none  |
| `build:`    | build pipeline          | none  |
| `ci:`       | CI changes              | none  |

Add `!` for breaking changes (`feat!:` / `fix!:`) — bumps major.

### Testing

- New code should ship with tests. Vitest is configured with V8 coverage; coverage thresholds will be enforced once tests land.
- The HTTP client is exercised through `fetch` mocks (`vi.stubGlobal('fetch', …)`), not a real network. Live API tests gated by `MCP_VOICENOTES_EDIT_PAT_TEST` live under `src/**/*.live.test.ts` and are skipped by default.

## Before opening a PR

- [ ] `bun run lint:check` passes
- [ ] `bun run lint:types` passes
- [ ] `bun run test:coverage` passes (no threshold failures, once thresholds are set)
- [ ] Commit messages follow Conventional Commits
- [ ] If you added a new tool, update `README.md`'s Tools section and `CLAUDE.md`'s tool registration call sites note

CI runs all of the above on every PR.
