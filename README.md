# just-text

Share text. Nothing else.

Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.

## Features

- **Instant sharing** — Paste text, get a shareable link. No account required.
- **Three formats** — Plain text, Markdown (rendered), or Code (syntax highlighted via Shiki with 20+ languages).
- **Dual URLs** — Every paste has a styled view (`/:id`) and a raw text version (`/text/:id`).
- **Burn after read** — Self-destructing pastes that are deleted after the first view.
- **Configurable expiry** — 1 hour to 1 year, or never.
- **Keyboard-first** — `Cmd+Enter` / `Ctrl+Enter` to share instantly.
- **Encryption at rest** — All paste content is encrypted with AES-256-GCM before storage.
- **Rate limiting** — Per-IP rate limits on creation and reading.
- **Abuse reporting** — Report button on every paste, auto-removal after 3 reports.
- **Security headers** — CSP, X-Frame-Options, no-sniff, no-referrer.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui, Tailwind CSS 4 |
| Font | JetBrains Mono |
| Database | Redis (Docker locally, Upstash/Vercel KV in production) |
| Syntax Highlighting | Shiki (server-side) |
| Markdown | react-markdown + remark-gfm + rehype-sanitize |
| Encryption | Node.js crypto (AES-256-GCM) |
| IDs | nanoid (10 chars, URL-safe) |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ or [Bun](https://bun.sh/) 1.0+
- [Docker](https://www.docker.com/) (for local Redis)

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url> just-text
cd just-text
bun install
```

### 2. Start Redis

```bash
docker compose up -d
```

This starts a Redis 7 container on port 6379 with persistent storage.

To verify it's running:

```bash
docker compose ps
```

To stop:

```bash
docker compose down
```

To stop and wipe all data:

```bash
docker compose down -v
```

### 3. Configure environment

Copy the example env file and generate an encryption key:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and set the `ENCRYPTION_KEY`. Generate one with:

```bash
openssl rand -hex 32
```

Paste the 64-character hex string as the value. The other defaults are fine for local development.

Full environment variables:

| Variable | Description | Default |
|---|---|---|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM encryption | (required) |
| `NEXT_PUBLIC_BASE_URL` | Public URL for generating share links | `http://localhost:3000` |
| `RATE_LIMIT_PASTE_MAX` | Max paste creations per window per IP | `10` |
| `RATE_LIMIT_PASTE_WINDOW_SECONDS` | Rate limit window for creation | `3600` |
| `RATE_LIMIT_READ_MAX` | Max reads per window per IP | `60` |
| `RATE_LIMIT_READ_WINDOW_SECONDS` | Rate limit window for reads | `60` |

### 4. Run the dev server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

### Create a paste

```bash
curl -X POST http://localhost:3000/api/paste \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello, world!",
    "format": "plain",
    "expirySeconds": 7776000,
    "burnAfterRead": false
  }'
```

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | yes | The text content (max 5MB) |
| `format` | string | yes | `"plain"`, `"markdown"`, or `"code"` |
| `language` | string | no | Language for syntax highlighting (when format is `"code"`) |
| `expirySeconds` | number | yes | One of: `3600`, `86400`, `604800`, `2592000`, `7776000`, `31536000`, `0` (never) |
| `burnAfterRead` | boolean | yes | If true, paste is deleted after first view |

**Response:**

```json
{
  "id": "vDagoO3Q5L",
  "url": "http://localhost:3000/vDagoO3Q5L",
  "rawUrl": "http://localhost:3000/text/vDagoO3Q5L",
  "expiresAt": 1781390382,
  "sizeBytes": 13
}
```

### Read a paste (JSON)

```bash
curl http://localhost:3000/api/paste/vDagoO3Q5L
```

### Read a paste (raw text)

```bash
curl http://localhost:3000/text/vDagoO3Q5L
```

This returns `Content-Type: text/plain; charset=utf-8` — perfect for piping:

```bash
curl -s http://localhost:3000/text/vDagoO3Q5L | pbcopy
```

### Report a paste

```bash
curl -X POST http://localhost:3000/api/report \
  -H "Content-Type: application/json" \
  -d '{"id": "vDagoO3Q5L", "reason": "spam"}'
```

Pastes are automatically removed after 3 reports.

## URL Structure

| URL | Description |
|---|---|
| `/` | Home page — create a paste |
| `/:id` | Styled view (syntax highlighting / markdown / plain with line numbers) |
| `/text/:id` | Raw plain text (`Content-Type: text/plain`) |
| `/api/paste` | POST to create a paste |
| `/api/paste/:id` | GET paste as JSON |
| `/api/report` | POST to report a paste |

## Security

- **Encryption at rest**: All content is encrypted with AES-256-GCM before being stored in Redis. The key is in your environment variables.
- **Non-sequential IDs**: Uses `nanoid(10)` which produces ~64^10 (~1.15 quadrillion) combinations. No enumeration possible.
- **Rate limiting**: Per-IP limits on both creation and reading, backed by Redis.
- **Content Security Policy**: Strict CSP headers prevent XSS.
- **Markdown sanitization**: User-submitted markdown is sanitized with `rehype-sanitize` before rendering.
- **No inline script execution**: Syntax highlighting runs server-side via Shiki.
- **Burn after read**: Atomic delete-on-read for sensitive content.
- **Auto-expiry**: Redis TTL ensures pastes are automatically deleted.
- **Abuse reporting**: Community-driven moderation with auto-removal threshold.

## Deployment

### Vercel + Upstash Redis

1. Push to GitHub
2. Import in Vercel
3. Add an [Upstash Redis](https://upstash.com/) database (or use Vercel KV which is Upstash under the hood)
4. Set environment variables in Vercel project settings:
   - `REDIS_URL` — your Upstash Redis URL (use the `redis://` URL, not the REST URL)
   - `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`
   - `NEXT_PUBLIC_BASE_URL` — your production URL (e.g., `https://justtext.dev`)
5. Deploy

## License

MIT
