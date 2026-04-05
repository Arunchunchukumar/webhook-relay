# webhook-relay

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A lightweight TypeScript microservice that receives webhooks from **GitHub**, **Slack**, and **Stripe**, verifies their signatures, and routes notifications to **Slack**, **Discord**, or **email** based on configurable rules.

## Architecture

```
                    +------------------+
 GitHub Webhooks -->|                  |--> Slack Channel
  Slack Events  -->|  Webhook Relay   |--> Discord Channel
Stripe Webhooks -->|   (Fastify)      |--> Email (SMTP)
                    +------------------+
                           |
                     Redis Queue
                    (rate limiting)
```

## Features

- **Signature Verification** - Validates webhook signatures for GitHub (HMAC-SHA256), Slack, and Stripe
- **Multi-Channel Routing** - Send notifications to Slack, Discord, or email based on rules
- **Rule Engine** - JSON-based routing rules with field matching and templating
- **Rate Limiting** - Redis-backed rate limiting to prevent notification floods
- **Docker Ready** - Full Docker and docker-compose setup
- **Type Safe** - Strict TypeScript with full type coverage

## Quick Start

```bash
# Clone and install
git clone https://github.com/Arunchunchukumar/webhook-relay.git
cd webhook-relay
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Slack/Discord tokens

# Development
npm run dev

# Production (Docker)
docker-compose up -d
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/github` | Receive GitHub webhooks |
| POST | `/webhooks/slack` | Receive Slack events |
| POST | `/webhooks/stripe` | Receive Stripe webhooks |
| GET | `/health` | Health check |

## Configuration

Routing rules in `config.json`:

```json
{
  "rules": [
    {
      "source": "github",
      "event": "pull_request.opened",
      "destinations": ["slack"],
      "slack_channel": "#engineering",
      "template": "New PR: {{title}} by {{user.login}}"
    }
  ]
}
```

## Project Structure

```
src/
  index.ts           # Fastify server setup and startup
  config.ts          # Environment and routing configuration
  routes/
    webhook.ts       # Webhook ingestion routes with signature verification
  services/
    slack.ts         # Slack notification sender
    discord.ts       # Discord notification sender
    email.ts         # Email notification sender (SMTP)
```

## Development

```bash
npm run dev       # Start with hot reload
npm run build     # Compile TypeScript
npm run lint      # Run ESLint
npm test          # Run tests
```

## License

MIT License - see [LICENSE](./LICENSE) for details.
