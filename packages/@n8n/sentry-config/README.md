# @n8n/sentry-config

Centralized Sentry filters for n8n. Adding new filters requires changes only in this package.

## Usage

```typescript
// Backend (packages/core)
import { createBackendBeforeSend } from '@n8n/sentry-config';
Sentry.init({ beforeSend: createBackendBeforeSend() });

// Frontend (packages/editor-ui)
import { createFrontendBeforeSend } from '@n8n/sentry-config';
Sentry.init({ beforeSend: createFrontendBeforeSend() });

// Task Runner (packages/@n8n/task-runner)
import { createTaskRunnerFilter } from '@n8n/sentry-config';
errorReporter.init({ beforeSendFilter: createTaskRunnerFilter() });
```

## What Gets Filtered

| Component | Filtered Errors |
|-----------|-----------------|
| Backend | AxiosErrors, SQLite disk/IO, n8n warning/info, duplicates |
| Frontend | AxiosErrors, ResizeObserver, RangeError (CodeMirror), connection errors |
| Task Runner | User code errors (VM execution, evalmachine) |

## Adding a New Filter

1. Edit the appropriate file in `src/filters/`:
   - `backend.ts` - Backend filters
   - `frontend.ts` - Frontend filters
   - `task-runner.ts` - Task runner filters
   - `shared.ts` - Filters for both FE & BE

2. Add your filter function and call it from the `createXxxBeforeSend()` function

3. Add tests in `src/__tests__/`

No changes needed in consumer packages - they pick up new filters automatically.

## Example: Adding a Backend Filter

```typescript
// 1. In src/filters/backend.ts - add your filter
export function isMyIgnoredError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('ETIMEDOUT');
}

// 2. In src/filters/index.ts - call it from createBackendBeforeSend
if (isMyIgnoredError(originalException)) return null;

// 3. In src/__tests__/backend.test.ts - add tests
it('should filter ETIMEDOUT errors', () => {
  expect(isMyIgnoredError(new Error('connect ETIMEDOUT'))).toBe(true);
});
```

## API

```typescript
// Composition functions
createBackendBeforeSend(options?)   // Returns BeforeSend for Sentry.init()
createFrontendBeforeSend(patterns?) // Returns BeforeSend for Sentry.init()
createTaskRunnerFilter()            // Returns ErrorFilter for errorReporter.init()

// Types
type BeforeSend = (event, hint) => event | null
type ErrorFilter = (event, hint) => boolean  // true = filter out
```
