# relay-tutorial

The application for the **Building Relay** tutorial series — a guided journey from an
empty directory to a deployed, monitored, multi-tenant chat infrastructure platform.

This repository is a **git submodule** of the main [`relay`](https://github.com/anhba817/relay)
repository, which holds the series' specification documents (product vision, SRS,
architecture document, ADRs, and the tutorial plan). The parent repo pins this repo at
an exact revision so prose and code never drift.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript, Tailwind CSS v4), generated
  with `create-next-app`
- [shadcn/ui](https://ui.shadcn.com) with the
  [Violet Bloom](https://tweakcn.com/themes) theme from tweakcn — light and dark modes
  via `next-themes` (follows your system preference by default)

## Getting started

Requires Node.js 22+ and [pnpm](https://pnpm.io) 10+.

```bash
pnpm install   # install dependencies
pnpm dev       # start the dev server at http://localhost:3000
pnpm build     # production build
pnpm lint      # lint
```

## Arriving via the parent repo?

If you cloned [`relay`](https://github.com/anhba817/relay), this directory is empty
until you initialize the submodule:

```bash
git submodule update --init
cd relay-tutorial
pnpm install
pnpm dev
```

Or clone with submodules in one step:

```bash
git clone --recurse-submodules git@github.com:anhba817/relay.git
```
