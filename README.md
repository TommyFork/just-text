# textdrop.sh

A minimal, secure pastebin for sharing text. No account needed, up to 5MB, with syntax highlighting, markdown rendering, and raw text access.

## Features

- **Instant sharing** — Paste text, get a shareable link. No account required.
- **Three formats** — Plain text, Markdown (rendered), or Code (syntax highlighted via Shiki with 20+ languages).
- **Dual URLs** — Every paste has a styled view (`/:id`) and a raw text version (`/text/:id`).
- **Burn after read** — Self-destructing pastes deleted after the first view.
- **Configurable expiry** — 1 hour to 1 year, or never.
- **Keyboard-first** — `Cmd+Enter` / `Ctrl+Enter` to share instantly.
- **Encryption at rest** — All paste content encrypted with AES-256-GCM before storage.
- **Rate limiting** — Per-IP rate limits on creation and reading.
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

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ or [Bun](https://bun.sh/) 1.0+
- [Docker](https://www.docker.com/) (for local Redis)

### 1. Clone and install

```bash
git clone https://github.com/TommyFork/textdrop.sh.git
cd textdrop.sh
bun install
```

### 2. Start Redis

```bash
docker compose up -d
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Generate an encryption key:

```bash
openssl rand -hex 32
```

Edit `.env.local` and set `ENCRYPTION_KEY` to the 64-character hex string.

### 4. Run the dev server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM encryption | (required) |
| `NEXT_PUBLIC_BASE_URL` | Public URL for generating share links | `http://localhost:3000` |
| `RATE_LIMIT_PASTE_MAX` | Max paste creations per window per IP | `10` |
| `RATE_LIMIT_PASTE_WINDOW_SECONDS` | Rate limit window for creation | `3600` |
| `RATE_LIMIT_READ_MAX` | Max reads per window per IP | `60` |
| `RATE_LIMIT_READ_WINDOW_SECONDS` | Rate limit window for reads | `60` |

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

Returns `Content-Type: text/plain; charset=utf-8`.

## URL Structure

| URL | Description |
|---|---|
| `/` | Home page — create a paste |
| `/:id` | Styled view (syntax highlighting / markdown / plain with line numbers) |
| `/text/:id` | Raw plain text (`Content-Type: text/plain`) |
| `/api/paste` | POST to create a paste |
| `/api/paste/:id` | GET paste as JSON |

## Security

- **Encryption at rest**: All content encrypted with AES-256-GCM before Redis storage.
- **Non-sequential IDs**: ~64^10 combinations — no enumeration possible.
- **Rate limiting**: Per-IP limits on creation and reading, backed by Redis.
- **Content Security Policy**: Strict CSP headers prevent XSS.
- **Markdown sanitization**: User markdown sanitized with `rehype-sanitize` before rendering.
- **No inline scripts**: Syntax highlighting runs server-side via Shiki.
- **Burn after read**: Atomic delete-on-read for sensitive content.
- **Auto-expiry**: Redis TTL ensures pastes are automatically deleted.

## Deployment

### Vercel + Upstash Redis

1. Push to GitHub
2. Import in Vercel
3. Add an [Upstash Redis](https://upstash.com/) database (or use Vercel KV)
4. Set environment variables in Vercel project settings:
   - `REDIS_URL` — your Upstash Redis URL
   - `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`
   - `NEXT_PUBLIC_BASE_URL` — your production URL
5. Deploy

## License

MIT
