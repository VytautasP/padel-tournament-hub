# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## This repo's decision records

Two records exist, and they are not equal:

- **`docs/DECISIONS.md`** — the frozen output of the initial design interview (26 decisions with
  their consequences). Historical; do not append to it.
- **`docs/adr/`** — every decision made from now on, one numbered file each.

**ADRs supersede `docs/DECISIONS.md` where they conflict.** When your work contradicts a row in
`DECISIONS.md`, don't edit that row — write an ADR that explicitly supersedes it and say so in the ADR.

## File structure

This is a **single-context** repo: one `CONTEXT.md` + `docs/adr/` at the root.

```
/
├── CONTEXT.md
├── docs/
│   ├── DECISIONS.md        ← frozen design record
│   ├── adr/
│   │   ├── 0001-....md
│   │   └── 0002-....md
│   └── agents/
└── projects/
    ├── padel-engine/       ← pure TS rules library
    └── padel-app/          ← Angular PWA
```

The split between `padel-engine` and `padel-app` is a **code boundary, not a domain boundary** —
both speak the same language of sessions, rounds, courts, benches and standings. One context.

For reference, a multi-context repo (signalled by `CONTEXT-MAP.md` at the root) would instead look like:

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
