# Session handoff — 2026-09-21 (D.5 fully closed, D.6 hooks complete)

Context for the next session (human or LLM). Read together with
[`TODO.md`](TODO.md) and [`MIGRATION_DATA.md`](MIGRATION_DATA.md).
Branches: `feature/D-plone6-cutover` (buildout + plonemeeting.core +
plonemeeting.communes), `plone6` (plonemeeting.restapi, no change this
session: both residuals were core bugs).

## What landed this session (committed)

plonemeeting.core (`feature/D-plone6-cutover`):
- `6d6754e0e` **restapi residual 1**: `get_dx_attrs` translated a
  synthetic `title_<field>` msgid; the MeetingItem schema uses the AT-era
  `PloneMeeting_label_*` msgids so every item attribute title was a raw
  msgid. It now translates the schema field `title` Message (fallback to
  `title_<field>` for fields without one). No `imio.pm.locales` work was
  needed, contrary to the previous handoff.
- `fd12db0df` **restapi residual 2** (`test_restapi_search_base_search_uid`):
  not an ordering leak. `PloneMeeting-postInstall` only depended on the
  `toolset` import step; GenericSetup 4.0 builds the step order from a
  `set`, so on Python 3 the step ran before `workflow` about 3 runs out
  of 4 → the one-state workflow did not exist yet → placeful policy chain
  for Folder skipped + tool role mappings skipped → `searches*` folders
  under the tool got `simple_publication_workflow` (private) → the
  dashboard collection was invisible to MeetingManagers → the REST search
  silently dropped the base collection query. Reproduce any such flake
  with `PYTHONHASHSEED=1..N`. Fixed by declaring dependencies on
  `typeinfo`, `workflow`, `rolemap`, `catalog`, `plone.app.registry`.
- `4953084ee` **D.6 extra state**: `migrations/p4top6/extra_state.py`
  (py2/py3 JSON codec + per-type attribute lists), `export_p43.py` (script
  for the 4.3 buildout), import hook restoring `pm_extra_state`.
- `902158614` **D.6 post-process**: `ToolPloneMeeting.init_meeting_root_folder`
  / `init_meeting_config_folder` extracted from `createMeetingConfigFolder`;
  `@@import_pm_post_process` re-applies the user folder setup and rebuilds
  `categorized_elements`.

buildout (`feature/D-plone6-cutover`):
- `ae8f6f6` runbook update + `patches/src-wip/` (diffs of the uncommitted
  P6 fixes in the 20 dependency checkouts; safety net only).
- this commit: `MIGRATION_DATA.md` (post-process step, versions dropped),
  `TODO.md` (D.5 restapi done, D.6 decisions ticked), this file.

## Test status (VERIFIED this session)

- **plonemeeting.restapi: 95 tests, 0 failures, 0 errors** (full run,
  `/tmp/pm_next_logs/restapi_full_after.log`). D.5 is closed on all
  three packages.
- **core `testP4ToP6Migration`: 19/19** (codec round-trips, item and
  meeting round-trips through the export and import hooks, post-process
  view). The last core commit (export_p43 POST/type-listing fix) added
  2 unit tests; only the 16 layer-free tests could be re-run after it
  (16/16), the 5 layer tests are blocked by the incident below. Re-run
  the whole module once the checkout is back.
- **communes full suite**: launched after the import-step fix
  (`/tmp/pm_next_logs/testmc_full.log`, `bin/testmc --layer='!.*Robot.*'`,
  host soffice up). It was still running when this file was written:
  check the tail of that log first. The import-step fix makes the layer
  setup deterministic (Folders under the tool always get the one-state
  workflow now), which could surface tests that only passed on the
  "wrong" ordering. Before the fix the previous session measured
  939/0F/0E.
- `bin/test -m testToolPloneMeeting` could NOT run after the folder-init
  refactor: see the `plonetheme.imioapps` incident below. Indirect
  coverage exists: the 19 migration tests create items after the
  refactor (`self.create()` → `getPloneMeetingFolder` →
  `createMeetingConfigFolder` → `init_meeting_config_folder`) and pass.
  Run `bin/test -m testToolPloneMeeting` once the checkout is back.

## Incident: `src/plonetheme.imioapps` emptied at 09:57 (NOT by this session)

At 09:57:35 the checkout was switched to an unborn orphan branch
`plone6` (HEAD → `refs/heads/plone6`, empty index, working tree emptied;
`git switch --orphan plone6` does exactly that). The local `python3`
branch and all objects are intact (`git log python3` → `ad66bf7`).
Nothing in this session ran git there; another Claude session was open
on the machine. Consequence: `plonemeeting.core/configure.zcml` includes
`plonetheme.imioapps`, so every NEW test process fails ZCML loading with
"Module plonetheme has no global imioapps" (the communes run started
before it and is unaffected). If this was the start of the P6 theme
port from scratch, the package needs at least an importable stub with a
`configure.zcml`. Otherwise restore with:

```sh
cd src/plonetheme.imioapps
git checkout python3
git apply ../../patches/src-wip/plonetheme.imioapps.patch   # the P6 WIP (12 deletions)
```

## Open threads (priority order)

1. **Decide about `src/plonetheme.imioapps`** (incident above), then read
   the communes log and fix anything the deterministic layer setup
   surfaced; run `bin/test -m testToolPloneMeeting`.
2. **D.6 end-to-end dry run** — the only D.6 box left. Needs a prod copy
   (`make copy-data server=<host> buildout=<cfg>`), a 4.3 buildout with
   `collective.exportimport = 1.16` / `plone.restapi = 7.9.1`, then the
   sequence in `MIGRATION_DATA.md` §1 (export script) and §2 (import
   steps 1–11, incl. `@@import_pm_post_process`). Expect the dry run to
   reveal: unsupported value types in the extra state (logged as
   warnings at export), profile-package attributes missing from
   `extra_state.py` lists, and encoding edge cases in histories.
3. **D.4 deferred reactivations** (not cutover blockers): AMQP / scan_id
   (16 marked comment blocks), TinyMCE style formats, nightly tasks
   external trigger, async previews, webspellchecker decision.
4. **D.7 rollout**: nothing started.

## Known noise

- `bin/code-analysis` (pre-commit hook of the buildout repo, non-blocking)
  reports isort findings in 162 files project-wide, including the
  pre-existing `p4top6` modules. Not worth chasing per file.
- `.lock` and `lib64` are untracked artefacts at the buildout root.

## Environment notes

- Logs: the session scratchpad may disappear mid-session; use
  `/tmp/pm_next_logs/` and grep, never dump full logs.
- **LibreOffice**: `test_pm_ItemExportPDFForm` needs the HOST soffice on
  :2002 (`make libreoffice-local`, or the equivalent `nohup soffice ...`),
  not the docker LO 7.3. Converter python is `var/uno-venv/bin/python3`.
- Robot tests always skipped: `--layer='!.*Robot.*'`.
- Test runners: `bin/testrestapi` (restapi, ~2.5 min full),
  `bin/test` (core), `bin/testmc` (communes, > 1 h full). The WSGI test
  server picks a free port, so parallel runs are fine.
- The 20 dependency checkouts carry uncommitted P6 fixes (never commit
  there, per project convention); `patches/src-wip/*.patch` are their
  snapshots (`git apply` inside the checkout to restore).
