# HookNexus CLI — Development & testing

**Languages:** [English](development.md) · [简体中文](development.zh-CN.md)

For maintainers and contributors working in this repository.

## Prerequisites

- Node.js **>= 18** (see `engines` in `package.json`)
- [pnpm](https://pnpm.io/) is recommended (scripts assume pnpm; adapt if you use npm or yarn)

## Clone and install

```bash
git clone <your-repo-url>
cd hooknexus-cli   # use your actual folder name
pnpm install
```

## Build

```bash
pnpm build
```

`prepublishOnly` runs a build before publish. Run `pnpm build` locally before debugging so `dist/` matches `bin/`.

## Run the CLI locally

After a build, either:

```bash
pnpm start -- --help
node bin/hooknexus.js --help
```

Everything after `pnpm start --` is passed to the CLI like `hooknexus …`.

## Tests

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

This runs the `test:commands` script (Vitest).

## Typecheck

```bash
pnpm lint
```

## What the tests cover (summary)

Command tests focus on critical paths for:

- `auth`
- `endpoints`
- `requests`
- `account`
- `config`
- `listen`
- `forward`

They also cover important **Free / Plus** branches, for example:

- Free: `requests replay` is blocked
- Plus: `requests replay` is allowed
- Plus: permanent endpoint creation

When you add commands or change billing/permission behavior, extend tests under `src/__tests__/`.
