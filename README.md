# pfa-website

A community directory of compact 3D printers, with printer details, documentation, and community mods.

During development and builds, this site crawls the GitHub repositories in
`src/content/printers.ts` for printer READMEs, mods, and mod descriptions. Set
`GITHUB_TOKEN` in `.env` to avoid GitHub API rate limits.

**[pfa-website.fdu.workers.dev](https://pfa-website.fdu.workers.dev/)**

Hosted on Cloudflare Workers.

## Getting started

Requires [Bun](https://bun.sh/).

Install dependencies:

```sh
bun install
```

Copy the example environment file:

```sh
cp .env.example .env
```

Start the development server:

```sh
bun dev
```

Open [http://localhost:4321](http://localhost:4321).

## Updating content

`src/content/printers.ts` is the source of truth for printer details, categories,
GitHub links, and mod repositories. Add or edit a printer in its `printers`
array. Its card image must be `src/assets/printers/<id>-hero.png`, where `<id>`
matches the printer's id.

Mods are discovered from each entry's `mods` repo and path glob. The behavior
for README content and thumbnail selection is defined in
`src/loaders/mods-loader.ts`; update mod content in the configured GitHub repo.

Edit the homepage intro in `src/content/docs/index.mdx`; add documentation as
Markdown or MDX under `src/content/docs/`.

## Discord

<https://discord.gg/mTM9x94aE>
