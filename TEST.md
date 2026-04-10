# Test Documentation

This document describes the test suite for `a-simple-llm-wallet`, how to run it locally, and what each test case covers.

## Running Tests Locally

### Prerequisites

- Node.js 18+
- Dependencies installed (`npm install`)

### Commands

```bash
# Run all tests once
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch
```

Expected output:

```
 ✓ src/tests/env-export.test.ts (10)
 ✓ src/tests/chat.test.ts (5)
 ✓ src/tests/wallet.test.ts (11)

 Test Files  3 passed (3)
      Tests  26 passed (26)
```

## Test Structure

Tests live in `src/tests/` and are written with [Vitest](https://vitest.dev/).

```
src/tests/
├── wallet.test.ts      # Core CRUD logic
├── env-export.test.ts  # .env generation
└── chat.test.ts        # LLM chat / connectivity
```

All tests are fully isolated — the storage layer (`~/.llm-wallet/wallet.json`) is mocked, and the OpenAI SDK is mocked. No real files are written and no real API calls are made.

---

## wallet.test.ts — 11 tests

Tests the core provider management logic in `src/wallet.ts`. The `storage` module is mocked so no disk I/O occurs.

### listProviders

| Test | Description |
|------|-------------|
| returns empty array when no providers | When the wallet is empty, `listProviders()` returns `[]` |
| returns all providers | When providers exist, all are returned with correct data |

### getProvider

| Test | Description |
|------|-------------|
| finds provider by exact id | Looks up a provider using its full UUID |
| returns undefined for unknown id | Returns `undefined` when the id does not exist |

### findProviderByName

| Test | Description |
|------|-------------|
| finds provider case-insensitively | Matches `"groq"`, `"GROQ"`, and `"Groq"` to the same provider |
| returns undefined for unknown name | Returns `undefined` when no provider matches the name |

### addProvider

| Test | Description |
|------|-------------|
| adds a provider and saves | Creates a new provider with a generated `id` and `createdAt`, and calls `storage.save()` exactly once with the correct data |

### updateProvider

| Test | Description |
|------|-------------|
| updates fields and saves | Merges partial input into the existing provider, preserves unchanged fields, and saves |
| returns null for unknown id | Returns `null` and does not call `save()` when the id is not found |

### deleteProvider

| Test | Description |
|------|-------------|
| deletes existing provider and returns true | Removes the provider from the list, saves, and returns `true` |
| returns false for unknown id | Returns `false` and does not call `save()` when the id is not found |

---

## env-export.test.ts — 10 tests

Tests the `.env` file generation logic in `src/env-export.ts`.

### generateEnvContent (prefixed mode)

| Test | Description |
|------|-------------|
| uses uppercased provider name as prefix | Output contains `GROQ_BASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL` |
| includes context window when set | Output contains `GROQ_CONTEXT_WINDOW=8192` |
| omits context window when not set | `CONTEXT_WINDOW` line is absent when the field is `undefined` |
| includes modalities | Multiple modalities are joined as a comma-separated value |
| sanitizes special characters in provider name | Spaces and dots in the name are replaced with `_` (e.g. `My Provider 2.0` → `MY_PROVIDER_2_0`) |
| ends with a newline | Output always ends with `\n` for safe file appending |

### generateGenericEnvContent (generic mode)

| Test | Description |
|------|-------------|
| uses OPENAI_* variable names | Output uses `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` regardless of provider name |
| includes context window when set | Output contains `OPENAI_CONTEXT_WINDOW=8192` |
| omits context window when not set | `CONTEXT_WINDOW` line is absent when the field is `undefined` |
| ends with a newline | Output always ends with `\n` |

---

## chat.test.ts — 5 tests

Tests the chat and connectivity logic in `src/chat.ts`. The `openai` SDK is mocked — no real HTTP requests are made.

### sendMessage

| Test | Description |
|------|-------------|
| returns the assistant reply | When the API returns a message, the content string is returned |
| returns fallback when content is null | When `choices[0].message.content` is `null`, returns `"(no response)"` |
| returns fallback when choices is empty | When `choices` is an empty array, returns `"(no response)"` |
| propagates errors from the API | When the SDK throws (e.g. `401 Unauthorized`), the error is re-thrown to the caller |

### quickTest

| Test | Description |
|------|-------------|
| sends a fixed ping message and returns the reply | Calls the API with a `user` role message and the correct model name, returns the response content |

---

## Notes

- Tests use `vi.clearAllMocks()` in `beforeEach` to prevent state leaking between cases.
- The `storage` mock prevents any reads or writes to `~/.llm-wallet/wallet.json` during testing.
- The `openai` mock prevents any network calls during testing, making the suite fast and offline-safe.
