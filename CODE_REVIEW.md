# Code Review Report — just-text

**Reviewed:** 2026-03-15
**Reviewer:** Claude Code
**Scope:** Full codebase — security, correctness, code quality, infrastructure

---

## Summary

The project is a pastebin-style app built with Next.js, Redis, and AES-256-GCM encryption. The core architecture is solid: encryption at rest, rate limiting, burn-after-read, and CSP headers are all present. However, there are several meaningful security and correctness issues that need attention before this is production-ready.

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High     | 3 |
| Medium   | 6 |
| Low      | 8 |

---

## Critical

### C1 — Burn-after-read is not atomic (`lib/paste.ts:96-106`)

The "burn after read" guarantee is broken under concurrent requests. The read and delete are two separate Redis operations:

```ts
const raw = await redis.get(key);         // Request A and B both GET here
if (!raw) return null;
const stored = JSON.parse(raw);
if (stored.burnAfterRead) {
    await redis.del(key);                 // Both then DEL — paste has been read twice
}
```

Two simultaneous requests for the same burn-after-read paste will both receive the content. This defeats the entire purpose of the feature.

**Fix:** Use a Lua script or `GETDEL` (Redis 6.2+) to make the get-and-delete atomic:
```ts
// Redis 6.2+
const raw = await redis.getdel(key);
```
Or use a Lua script for older Redis:
```lua
local val = redis.call('GET', KEYS[1])
if val then redis.call('DEL', KEYS[1]) end
return val
```

---

## High

### H1 — Anyone can delete any paste via coordinated reports (`lib/paste.ts:130-145`)

The auto-deletion logic deletes a paste after 3 reports. The rate limit is 5 reports per IP per hour, but an attacker with 3 different IPs (VPN, proxy, mobile data) can delete any paste they know the ID of:

```ts
const count = await redis.llen(reportKey);
if (count >= 3) {
    await redis.del(pasteKey(id));   // Deleted — no human review required
}
```

There is no verification that the paste actually contains abusive content, no human review step, and no notification that deletion occurred.

**Fix (short-term):** Remove the auto-delete or raise the threshold significantly (e.g., 10+ reports). **Fix (long-term):** Queue reports for manual admin review rather than auto-deleting.

### H2 — CSP `unsafe-inline` and `unsafe-eval` defeat XSS protection (`next.config.ts:19`)

The Content-Security-Policy header includes both `'unsafe-inline'` and `'unsafe-eval'` in `script-src`:

```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

This renders the CSP effectively useless against XSS attacks — any injected script tag will execute. These directives are typically required for Next.js dev mode but should be removed in production.

**Fix:** Use nonce-based CSP in production. Next.js supports this via middleware. At minimum, add an environment check:
```ts
const isDev = process.env.NODE_ENV === "development";
// Only include unsafe-* in dev
```

### H3 — Encryption key hex validation is incomplete (`lib/crypto.ts:9`)

The key validation only checks string length:

```ts
if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string...");
}
```

A 64-character string of non-hex characters (e.g., `"ZZZZ...Z"`) passes validation. `Buffer.from(hex, "hex")` silently produces a shorter buffer with `\x00` padding rather than throwing, resulting in a weaker or corrupt encryption key with no error.

**Fix:**
```ts
if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string...");
}
```

---

## Medium

### M1 — View count has a race condition (`lib/paste.ts:100-106`)

The view count is updated with a non-atomic read-modify-write:

```ts
stored.viewCount += 1;                          // Read
const ttl = await redis.ttl(key);
await redis.set(key, JSON.stringify(stored));   // Write
if (ttl > 0) {
    await redis.expire(key, ttl);
}
```

Under concurrent requests both read `viewCount: 5`, both write `viewCount: 6`, losing one increment. Additionally, the `SET` command between the `TTL` read and `EXPIRE` call creates a window where the key momentarily has no TTL, making it persist forever if the server crashes at that moment.

**Fix:** Use `HINCRBY` with a Redis hash structure for the counter, or if keeping JSON, use a Lua script for the full read-increment-write-expire sequence atomically.

### M2 — IP header is fully trusted, enabling rate limit bypass (`lib/ip.ts:6`)

```ts
h.get("x-forwarded-for")?.split(",")[0]?.trim()
```

The `X-Forwarded-For` header is set by the client, not just by proxies. Any client can set it to an arbitrary value to bypass rate limiting. If this app runs behind a reverse proxy (nginx, Cloudflare, etc.), only the last `X-Forwarded-For` value should be trusted — or better, the proxy should set a custom trusted header.

**Fix:** If running behind a known proxy, take the last IP in the chain, not the first (the first is client-controlled). Or configure the reverse proxy to set `X-Real-IP` from the actual socket address and rely only on that header.

### M3 — `request.json()` errors return 500 instead of 400 (`app/api/paste/route.ts:32`, `app/api/report/route.ts:18`)

Both API routes call `await request.json()` inside a try-catch, but the catch returns a generic 500 error:

```ts
const body = await request.json();  // Throws SyntaxError on invalid JSON
```

A client sending malformed JSON gets a 500 Internal Server Error instead of a 400 Bad Request, which is misleading and leaks that an unhandled error occurred.

**Fix:** Wrap JSON parsing separately:
```ts
let body: unknown;
try {
    body = await request.json();
} catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}
```

### M4 — `JSON.parse` on Redis data has no error handling (`lib/paste.ts:94`, `lib/paste.ts:124`)

```ts
const stored: StoredPaste = JSON.parse(raw);
```

Corrupted or manually-edited Redis data would throw `SyntaxError`, crashing the request handler with an unhandled exception that surfaces as a 500 error.

**Fix:** Wrap in try-catch and return `null` (treating corrupted data as a missing paste).

### M5 — Redis port exposed to host network (`docker-compose.yml:5`)

```yaml
ports:
  - "6379:6379"
```

This binds Redis to `0.0.0.0:6379` on the host, making it accessible from outside the container and potentially from the internet if the host firewall is not configured. Redis has no authentication configured in the compose file.

**Fix:** Remove the `ports` mapping for production deployments, or change to `127.0.0.1:6379:6379`. Add Redis password authentication with `--requirepass`.

### M6 — `NEXT_PUBLIC_BASE_URL` undefined produces broken URLs (`app/api/paste/route.ts:89-90`)

```ts
url: `${process.env.NEXT_PUBLIC_BASE_URL}/${paste.id}`,
rawUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/text/${paste.id}`,
```

If `NEXT_PUBLIC_BASE_URL` is not set, these URLs become `"undefined/abc123"`. This is a usability bug in the API response and exposes that the environment is misconfigured.

**Fix:** Provide a fallback or validate on startup. In the API handler, use the `request` URL origin as fallback:
```ts
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
```

---

## Low

### L1 — `CopyButton` silently shows "Copied!" on clipboard failure (`components/copy-button.tsx:22-25`)

```ts
async function handleCopy() {
    await navigator.clipboard.writeText(text);  // No try-catch
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
}
```

If clipboard access is denied (non-HTTPS context, permission denied, older browser), the promise rejects and the error propagates as an unhandled rejection. The button does not show "Copied!" in this case, but there is no user feedback either. There is also no `onClick={handleCopy}` error boundary.

**Fix:**
```ts
async function handleCopy() {
    try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    } catch {
        // optionally show an error state
    }
}
```

### L2 — Report dialog does not reset state on reopen (`components/report-dialog.tsx`)

When the dialog is closed after an error and reopened, `status` is still `"error"`, `reason` still contains the previous text. This is confusing UX — the user sees stale state.

**Fix:** Reset `status` and `reason` in the close handler:
```ts
onClick={() => { setOpen(false); setStatus("idle"); setReason(""); }}
```

### L3 — No check that reported paste exists (`app/api/report/route.ts:34`, `lib/paste.ts:130`)

`reportPaste(id, reason)` does not verify the paste exists. An attacker can flood the report store with reports for arbitrary/nonexistent IDs, wasting Redis memory.

**Fix:** Call `getPasteMetadata(id)` first and return 404 if not found.

### L4 — `formatBytes`/`formatSize` duplicated in three files

`formatBytes` (or `formatSize`) is defined with identical logic in:
- `components/paste-form.tsx:119` (named `formatSize`, defined inside the component)
- `components/paste-view.tsx:27`
- `components/share-modal.tsx` (based on subagent review)

**Fix:** Extract to `lib/format.ts` and import.

### L5 — `formatSize` defined inside render function (`components/paste-form.tsx:119`)

Defining a function inside a component body means it's re-created on every render.

**Fix:** Move it outside the component or extract to `lib/format.ts` (see L4).

### L6 — `rawUrl` state in `PasteView` causes an unnecessary render (`components/paste-view.tsx:34-38`)

```ts
const [rawUrl, setRawUrl] = useState(`/text/${paste.id}`);
useEffect(() => {
    setRawUrl(`${window.location.origin}/text/${paste.id}`);
}, [paste.id]);
```

This pattern causes a flash of the wrong URL and an extra render. Since this is a `"use client"` component, `window` is available at render time and doesn't need a state+effect.

**Fix:** Remove the state and effect; compute directly:
```ts
const rawUrl = typeof window !== "undefined"
    ? `${window.location.origin}/text/${paste.id}`
    : `/text/${paste.id}`;
```

### L7 — Language validation condition is logically inverted (`app/api/paste/route.ts:72`)

```ts
if (format === "code" && language && typeof language !== "string") {
```

This returns 400 only if `language` is truthy AND not a string. If `language` is `null` or `undefined`, the condition is skipped entirely and a non-string `null` language gets through. Since `body` comes from `request.json()` which is typed as `any`, this is a real edge case.

**Fix:**
```ts
if (format === "code" && language !== undefined && typeof language !== "string") {
```

### L8 — No `.env.example` file

Required environment variables are undocumented. A new developer or deployment has no reference for what to set. Missing `ENCRYPTION_KEY` causes a cryptic startup crash; missing `NEXT_PUBLIC_BASE_URL` produces broken share URLs silently.

**Required variables to document:**
- `ENCRYPTION_KEY` — 64-char hex, generate with `openssl rand -hex 32`
- `REDIS_URL` — e.g., `redis://localhost:6379`
- `NEXT_PUBLIC_BASE_URL` — e.g., `https://yourdomain.com`
- `RATE_LIMIT_PASTE_MAX` (optional, default 10)
- `RATE_LIMIT_PASTE_WINDOW_SECONDS` (optional, default 3600)
- `RATE_LIMIT_READ_MAX` (optional, default 60)
- `RATE_LIMIT_READ_WINDOW_SECONDS` (optional, default 60)

---

## What's Done Well

- **AES-256-GCM encryption at rest** with random IV per paste — correct implementation
- **GCM authentication tag** is stored and verified on decrypt — prevents tampering
- **Rate limiting** implemented for both paste creation and reading
- **Markdown sanitized** via `rehype-sanitize` — no XSS from user markdown
- **Strict TypeScript** with Biome linting configured
- **Input validation** on all API routes (content type, size, format, expiry)
- **Security headers** present: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- **Burn-after-read** feature is architecturally present (just needs to be made atomic — C1)
- **Docker healthcheck** on Redis
- **Redis persistence** with `--appendonly yes`
- **`rehype-sanitize`** on markdown renders — correct

---

## Recommended Action Priority

### Immediate (before any production traffic)
1. **C1** — Make burn-after-read atomic with `GETDEL` or Lua script
2. **H1** — Remove or raise auto-delete threshold on reports; add human review
3. **M3** — Wrap `request.json()` in its own try-catch to return 400 on bad JSON
4. **M4** — Wrap `JSON.parse(raw)` in try-catch in `getPaste` and `getPasteMetadata`
5. **L8** — Create `.env.example`

### Short-term
6. **H2** — Remove `unsafe-inline`/`unsafe-eval` from production CSP (use nonce)
7. **H3** — Add hex regex validation to `getKey()`
8. **M1** — Make view count atomic (use `HINCRBY` or Lua)
9. **M5** — Remove Redis port binding from docker-compose; add Redis password
10. **M6** — Add `NEXT_PUBLIC_BASE_URL` fallback in API response

### Medium-term
11. **M2** — Harden IP extraction for your reverse proxy setup
12. **L1** — Add try-catch to clipboard write
13. **L3** — Validate paste exists before accepting reports
14. **L4/L5** — Extract `formatBytes` to `lib/format.ts`
15. **L6** — Remove unnecessary state+effect for `rawUrl`
