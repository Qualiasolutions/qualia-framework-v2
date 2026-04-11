---
name: qualia-test
description: "Generate or run tests for client projects. Trigger on 'write tests', 'add tests', 'test this', 'run tests', 'test coverage', 'need tests for'."
---

# /qualia-test — Test Generator

Generate tests for client project code. Detect framework, classify targets, write tests, run them.

## Usage

- `/qualia-test` — Generate tests for recently changed files
- `/qualia-test {file}` — Generate tests for a specific file
- `/qualia-test --run` — Run existing tests and report
- `/qualia-test --coverage` — Run with coverage report

## Process

```bash
node ~/.claude/bin/qualia-ui.js banner test
```

### 1. Detect Test Framework

```bash
node -e "
const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));
const d={...p.dependencies,...p.devDependencies};
console.log(JSON.stringify({
  vitest: !!d.vitest,
  jest: !!d.jest,
  playwright: !!d['@playwright/test'],
  testing_library: !!d['@testing-library/react']
}))
"
```

If no test framework found, install vitest (lighter than jest for Next.js/Vite):

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `vitest.config.ts` if it doesn't exist:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

### 2. Find Targets

If specific file given → use that.
If `--run` → skip to step 4.
Otherwise find recently changed untested files:

```bash
# Files changed in last 5 commits that don't have tests
git diff --name-only HEAD~5 --diff-filter=AM -- '*.ts' '*.tsx' 2>/dev/null | grep -v "test\|spec\|__test__\|\.d\.ts" | head -10
```

### 3. Generate Tests

For each target file, classify it and generate the appropriate test:

**API route** (`app/api/**/route.ts`):
- Test each exported handler (GET, POST, PUT, DELETE)
- Test with valid input → expected response
- Test with invalid input → 400 error
- Test without auth → 401 (if auth is required)

**Server action** (has `"use server"`):
- Test each exported function
- Test with valid args → expected result
- Test with invalid args → error handling

**React component** (`*.tsx` with JSX):
- Test rendering without crashing
- Test interactive elements (clicks, form submissions)
- Test loading, error, and empty states if they exist
- Test accessibility (role, aria-label presence)

**Utility function** (`lib/*.ts`, `utils/*.ts`):
- Test each exported function with normal input
- Test edge cases: empty, null, undefined, boundary values
- Test error cases: invalid input, missing data

Write test file next to the source: `{file}.test.ts` or `{file}.test.tsx`.

### 4. Run Tests

```bash
# Vitest
npx vitest run --reporter=verbose 2>&1 | tail -30

# Or Jest
npx jest --verbose 2>&1 | tail -30

# Coverage (if --coverage flag)
npx vitest run --coverage 2>&1 | tail -30
```

### 5. Report

```bash
node ~/.claude/bin/qualia-ui.js divider
node ~/.claude/bin/qualia-ui.js info "Files tested: {N}"
node ~/.claude/bin/qualia-ui.js ok "Passing: {pass}/{total}"
node ~/.claude/bin/qualia-ui.js end "TESTS DONE"
```

If any tests fail, show the failures and offer to fix them.

### 6. Commit

```bash
git add {test files}
git commit -m "test: add tests for {files}"
```

## Rules

1. **Test behavior, not implementation.** Don't test internal state — test what the user/caller sees.
2. **No snapshot tests.** They're brittle and meaningless.
3. **No mocking unless necessary.** Test real behavior. Mock only external services (APIs, databases).
4. **Each test file is self-contained.** No shared mutable state between tests.
5. **Name tests as sentences.** `it("returns 401 when user is not authenticated")` not `it("test auth")`.
