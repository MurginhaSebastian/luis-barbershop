# Bundled Skill Attribution

Every skill in `.claude/skills/` that came from a third party: where it came from,
what license it carries, and every byte this repo changed.

## redesign-existing-projects

- **Origen:** archivo `SKILL.md` aportado por el dueño del proyecto (30 de septiembre de 2026).
  No trae repositorio ni licencia declarados.
- **Modificaciones locales:** ninguna en `SKILL.md`. Las excepciones de este proyecto están en
  su `NOTICE.md`.

## Emil Kowalski — animation & design engineering (8 skills)

- **Upstream:** https://github.com/emilkowalski/skills
- **Pinned commit:** `e879241fab3cdb22e8d95587cdbf40b57a88d7da` (branch `main`, 2026-08-18)
- **License:** MIT, Copyright (c) 2026 Emil Kowalski. Full text in each skill's `LICENSE.txt`.
- **Author's course:** https://animations.dev

| Skill | Upstream path | Local modifications |
|---|---|---|
| `emil-design-eng` | `skills/emil-design-eng/` | **Yes — 1 hunk.** See M1. |
| `animate` | `skills/animate/` | **Yes — 1 line.** See M2. |
| `review-animations` | `skills/review-animations/` | None. `disable-model-invocation: true` preserved. |
| `improve-animations` | `skills/improve-animations/` | None. |
| `find-animation-opportunities` | `skills/find-animation-opportunities/` | None. |
| `animation-vocabulary` | `skills/animation-vocabulary/` | None. |
| `apple-design` | `skills/apple-design/` | None. |
| `prototype` | `skills/prototype/` | None. `disable-model-invocation: true` preserved. |

**Not bundled, on purpose:** `animate-expo` (React Native, out of scope), `ask-sonner`
(toast library not used here), `pick-ui-library` (this repo builds its own components and
uses no component library).

### Local modifications, in full

**M1 — `emil-design-eng/SKILL.md`, the `## Initial Response` section replaced.**
Upstream required answering a bare invocation with only a one-line greeting and then
waiting for the user. CLAUDE.md's Auto-Pilot Rules forbid asking during Phases 3-5, so
this would deadlock the autonomous build. Replaced with an `## Attribution` section that
preserves Emil's credit and the animations.dev link without the stop-and-wait. No other
line of the file is changed.

**M2 — `animate/SKILL.md`, one line.**
Upstream instructs the agent to "stop and invoke `pick-ui-library`", which is deliberately
not bundled here. Repointed at the repo's own components. Same intent, working target.

## Anthropic — frontend-design (Apache 2.0)

Licensed under the Apache License 2.0. See `frontend-design/NOTICE.md`.
On **motion**, this repo's authority is `animate` / `emil-design-eng`, not
`frontend-design/reference/motion-design.md`. See CLAUDE.md.

## Other vendored skills

| Skill | Source | License | Local modifications |
|---|---|---|---|
| `ui-ux-pro-max` | Next Level Builder | MIT — `LICENSE` | **Yes.** `scripts/core.py`: restored 12 entries to `STACK_CONFIG` (the vendored copy shipped only `react-native`, which disabled `--stack` for the other 12 values). `data/stacks/`: added 12 CSVs. `data/`: removed `draft.csv` and `design.csv` (unreferenced, 212 KB; `draft.csv`'s own header states the engine does not read it). `SKILL.md`: corrected 12 script paths (`skills/` -> `.claude/skills/`), retargeted from React Native to Next.js + shadcn, removed the non-existent `--domain prompt`, restored the 13-stack table. |
| `vercel-deploy` | Vercel | MIT — `LICENSE.txt` | None. |
| `vercel-react-best-practices` | Vercel | MIT — frontmatter | None. |
| `web-reader` | z-ai-web-dev-sdk Skills | MIT — `LICENSE.txt` | None. |
| `all-deploy` | https://github.com/Hainrixz/all-deploy, commit `42600c412c2188885c68e19a1e704bb7b0b130b5` (2026-09-19) | MIT — `LICENSE` | None in the files copied. Only `SKILL.md`, `LICENSE`, `references/`, `assets/templates/` and the three runtime scripts (`audit.py`, `env_extract.py`, `static_check.py`); left out tests, CI, images, `cowork-plugin/` and the packaging scripts. `assets/templates/.env.example.template` is not committed: the repo's `.gitignore` excludes `.env.*`. |
| `cloudflare-security-audit` | https://github.com/cloudflare/security-audit-skill, commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (2026-09-14), folder `skills/security-audit/` | MIT — `LICENSE` (Copyright 2025-2026 Cloudflare, Inc.) | **Yes — 1 line.** `SKILL.md` frontmatter `name: security-audit` → `name: cloudflare-security-audit`, so it does not shadow this repo's own `security-audit` skill. Everything else copied as is, tests included. |

## Updating the Emil skills

```bash
UPSTREAM_SHA=<new-sha>
SCRATCH=$(mktemp -d)
git clone --filter=blob:none --no-checkout https://github.com/emilkowalski/skills.git "$SCRATCH/emil"
git -C "$SCRATCH/emil" sparse-checkout init --cone
git -C "$SCRATCH/emil" sparse-checkout set skills/emil-design-eng skills/animate \
  skills/review-animations skills/improve-animations skills/find-animation-opportunities \
  skills/animation-vocabulary skills/apple-design skills/prototype
git -C "$SCRATCH/emil" checkout "$UPSTREAM_SHA"
for s in emil-design-eng animate review-animations improve-animations \
         find-animation-opportunities animation-vocabulary apple-design prototype; do
  cp "$SCRATCH/emil/skills/$s"/*.md ".claude/skills/$s/"
  cp "$SCRATCH/emil/LICENSE" ".claude/skills/$s/LICENSE.txt"
done
rm -rf "$SCRATCH"
```

Then re-apply **M1** and **M2** above, and bump the pinned SHA in this file.
