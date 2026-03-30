# HookNexus CLI

**Languages:** [English](README.md) · [简体中文](README.zh-CN.md)

The official HookNexus command-line tool. Use it to sign in, manage endpoints, listen for webhooks, inspect requests, and forward live webhooks to a local URL.

## Requirements

- [Node.js](https://nodejs.org/) **18 or newer**

## Install

```bash
npm install -g hooknexus
```

After a global install, run `hooknexus` in your terminal. Some setups also expose the `hnx` alias (see the `bin` field in `package.json`).

## Quick start

```bash
# 1. Sign in (GitHub OAuth only for now)
hooknexus login

# 2. Create an endpoint
hooknexus endpoints create

# 3. Start listening
hooknexus listen

# 4. Forward to your machine
hooknexus forward --to http://localhost:3000/webhook
```

## Commands

### Auth

```bash
hooknexus login
hooknexus logout
hooknexus whoami
```

- `login` uses GitHub OAuth
- If you are already logged in locally, the CLI asks whether to switch accounts

### Endpoints

```bash
hooknexus endpoints
hooknexus endpoints ls
hooknexus endpoints create
hooknexus endpoints create --permanent
hooknexus endpoints info <endpoint-id>
hooknexus endpoints delete <endpoint-id>
```

Notes:

- Running `endpoints` with no subcommand prints help for that group
- `--permanent` is a **Plus** feature

### Listen

```bash
hooknexus listen
hooknexus listen <endpoint-id>
hooknexus listen <endpoint-id-1> <endpoint-id-2>
hooknexus listen --all
hooknexus listen --json
hooknexus listen --quiet
```

Notes:

- With no endpoint argument, the CLI loads endpoints for your account
- If you have exactly one endpoint, it is selected automatically
- If you have several, the CLI prompts you in an interactive terminal
- If you have none, it creates a normal endpoint and continues

### Forward to local

```bash
hooknexus forward --to http://localhost:3000/webhook
hooknexus forward <endpoint-id> --to http://localhost:3000/webhook
hooknexus forward --to http://localhost:3000 --preserve-path
hooknexus forward --to http://192.168.1.100:8080 --allow-external
```

Notes:

- Available on **Free** and **Plus**
- By default only `localhost`, `127.0.0.1`, and `.local` targets are allowed
- Use `--allow-external` to forward to a non-local URL
- Endpoint selection matches `listen` when you omit the endpoint id

### Requests & replay

```bash
hooknexus requests
hooknexus requests ls <endpoint-id>
hooknexus requests show <request-id>
hooknexus requests body <request-id>
hooknexus requests replay <request-id> --to http://localhost:3000/webhook
```

Notes:

- Running `requests` alone prints help for that group
- `requests body` pretty-prints JSON when the body parses as JSON
- Partial request ids prompt you to run `requests ls` for the full id
- `requests replay` is **Plus** only

### Account & billing

```bash
hooknexus account info
hooknexus account subscription
hooknexus upgrade
```

### Config

```bash
hooknexus config ls
hooknexus config get apiUrl
hooknexus config set apiUrl https://api.hooknexus.com
hooknexus config set authUrl https://api.infra-hub.hooknexus.com
hooknexus config set timeout 30000
hooknexus config reset
hooknexus config path
```

Configurable keys:

- `apiUrl`
- `authUrl`
- `webUrl`
- `outputFormat`
- `color`
- `timeout`

## Common flags

```bash
hooknexus --help
hooknexus --version
hooknexus --no-color
hooknexus <command> --json
```

## Plans

| Capability | Free | Plus |
|------------|------|------|
| Temporary endpoints | 3 | 10 |
| Permanent endpoints | — | 1 |
| WebSocket listeners | 2 per endpoint | 3 per endpoint |
| Forward to local | Yes | Yes |
| Request replay | — | Yes |
| Request retention | 24 hours | 30 days |
| API key | — | Yes |

## Troubleshooting

### 1. `Not logged in`

Sign in again:

```bash
hooknexus login
```

### 2. `Request not found`

The id is often incomplete. List requests for the endpoint:

```bash
hooknexus requests ls <endpoint-id>
```

### 3. `Target URL must be localhost`

To allow a remote URL, pass:

```bash
hooknexus forward --to http://example.com/webhook --allow-external
```

### 4. `Request replay is available on the Plus plan and above`

Replay is not on Free. Upgrade with:

```bash
hooknexus upgrade
```

## How it talks to HookNexus

- Business API default: `https://api.hooknexus.com`
- Auth / billing API default: `https://api.infra-hub.hooknexus.com`
- After login, a JWT is stored locally
- WebSocket connections send both an `Authorization` header and a query token

## Development & contributing

See [docs/development.md](docs/development.md). Chinese: [docs/development.zh-CN.md](docs/development.zh-CN.md).
