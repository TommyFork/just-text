# Contributing to textdrop.sh

Thank you for your interest in contributing!

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Setup

```bash
git clone https://github.com/TommyFork/textdrop.sh.git
cd textdrop.sh
bun install
docker compose up -d
cp .env.local.example .env.local
# Edit .env.local and set ENCRYPTION_KEY
bun dev
```

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
bun run lint
```

## Testing

```bash
bun run test
```

## Questions?

Open an issue on [GitHub](https://github.com/TommyFork/textdrop.sh/issues) for any questions or suggestions.
