# Session handoff — 2026-09-21 (D.5 closed, D.5bis second pass, D.6 hooks complete)

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
- **core `testP4ToP6Migration`: 21/21** (codec round-trips, export
  script helpers, item and meeting round-trips through the export and
  import hooks, post-process view). Re-run of the whole module after the
  theme checkout came back: 16 layer-free + 5 layer tests, 0 failures
  (`/tmp/pm_next_logs/test_p4top6_rerun.log`).
- **communes full suite after the import-step fix: 939 tests,
  0 failures, 1 error, 12 skipped** (`/tmp/pm_next_logs/testmc_full.log`,
  `bin/testmc --layer='!.*Robot.*'`, 41 min). The one error is
  `test_pm_ItemExportPDFForm`: "Couldn't connect to LibreOffice on port
  2002" (soffice was not serving during the run), the same
  environment-only error as in the previous session. Identical to the
  pre-fix baseline, so the deterministic layer setup (Folders under the
  tool always get the one-state workflow now) surfaced nothing.
- **core `testToolPloneMeeting`: 40/40** after the folder-init refactor
  (`init_meeting_root_folder` / `init_meeting_config_folder`), re-run
  once the theme checkout was back (`/tmp/pm_next_logs/test_tool_rerun.log`).

## Resolved: `src/plonetheme.imioapps` rewritten on `plone6`

The checkout was emptied at 09:57 by another session as the start of the
Plone 6.1 theme port. Between 10:05 and 10:31 that session committed the
new theme (4 commits on `plone6`, tracked by `fork/plone6`, working tree
clean) and `sources.cfg` now points at `duchenean/plonetheme.imioapps`
branch `plone6`. ZCML loading works again; the two blocked core modules
were re-run and pass (see test status above). The old `python3` branch
and `patches/src-wip/plonetheme.imioapps.patch` are kept for reference
only.

## Front-end session (2026-09-21, afternoon)

State, verification and the open list are in `TODO.md` § D.5bis. Key facts
for whoever picks this up:

- Core commit on `feature/D-plone6-cutover` (profile 4301, bundles,
  `browser/static/`, CSS port, icons, popups port, `migrate_to_4301`).
- Dependency checkouts changed (uncommitted, snapshots in
  `patches/src-wip/`): imio.helpers (modal helper), imio.actionspanel,
  imio.annex, imio.dashboard, ftw.labels, collective.eeafaceted.{collection
  widget,dashboard,batchactions}, collective.iconifiedcategory,
  collective.js.iframeresizer, collective.js.jqueryui (new checkout).
- The dev site DB already has profile 4301 applied and the bundle records
  loaded; `bin/instance1` still runs the old ZCML → restart it.
- To verify without touching the user's instance: copy
  `parts/instance1/etc/{zope.conf,wsgi.ini}`, change CLIENTHOME, the log
  paths and `fast-listen` to :8091, run
  `bin/python parts/instance1/bin/interpreter <Zope egg>/Zope2/Startup/serve.py <wsgi.ini> -d debug-mode=on`.
  Reload pages with `location.reload()`: navigating to a URL that differs
  only by its `#hash` does not reload the document.
- Lesson: never point a bundle `jscompilation`/`csscompilation` at a skin
  file (FSFile) — the resource viewlet raises and every page 500s.

## D.5bis second pass (2026-09-21, later afternoon)

Decision: keep `collective.quickupload` (mockup `pat-upload` has no per-file
title/category form). Everything below was verified with a headless Chrome
harness, see `tools/browser-checks/README.md` (Playwright from a sibling
project, private instance on `localhost:8091`; the theme is off on
`127.0.0.1`, diazo hostname blacklist).

Core commits on `feature/D-plone6-cutover` (this session): the
`dxWidgetValue` on the request (plone.protect write-on-read, left
uncommitted by the previous session) and the D.5bis follow-ups (quickupload
settings in `registry.xml`, `migrate_to_4301` installs quickupload and loads
the select2 bundles, `annexDecision` icons, popups.js history/quick upload
bindings, `AnnexActionsPanelView` parent walk removed). Another session
committed `7da25063f` (rail counts) which swept the `plonemeeting.js`
INITIALIZE change in; the buildout `0869d46` (D.5ter) swept the first
TODO.md quickupload edit in. Both fine.

Dependency checkouts changed (uncommitted, snapshots in `patches/src-wip/`):
imio.annex (quickupload profile dependency, bundle order, `global_defines`,
SESSION, `pretty_title_or_id`, CSRF token, icons), imio.helpers (qq override
guard), collective.eeafaceted.collectionwidget and collective.z3cform.select2
(INITIALIZE binding; select2 also gets a `profiles/plone6/` with bundles),
collective.eeafaceted.batchactions (absolute form action), imio.actionspanel
(spinner, `++plone++` icon paths), collective.quickupload (SESSION,
`pretty_title_or_id`), imio.webspellchecker (no script tag without a bundle
URL).

Dev DB (`Plone` on the shared ZEO) already has: quickupload installed with
the four settings, `imio-annex-quickupload` and select2 bundle records,
annex/annexDecision FTI icons. The five test annexes created on
`copy_of_recItem2` were deleted again. `bin/instance1` still needs a restart.

Browser results: dashboard console clean, 14/14 faceted widgets registered
(incl. `c1`); history, add annex, quick upload (real upload creates the
annex with its category) and batch "Changer l'état" modals open and close;
item view and annexes page without console errors.

Tests: final combined run of `testAnnexes`, `testP4ToP6Migration` and
`testSetup` after all edits: **83 tests, 0 failures, 0 errors, 4 skipped**
(`/tmp/pm_next_logs/test_final_d5bis.log`).

## Open threads (priority order)

1. **D.5bis residuals** (TODO.md "Still to do"): class-name checks vs the
   DX item subclasses, popups not reachable on the dev items (transition
   with comment, duplicate, PDF export, advice, attendees), the
   `Migrator._before_reinstall` CKEditor properties, restart `bin/instance1`.
2. **Theme layout** (D.5ter, theme session): searches column stacks above
   the content, folder actions button row, unstyled searches portlet on
   item pages.
3. **Re-run `bin/testmc -t test_pm_ItemExportPDFForm`** with the host
   soffice serving on :2002 (`make libreoffice-local`); the only test
   not seen green in this environment.
4. **D.6 end-to-end dry run** — the only D.6 box left. Needs a prod copy
   (`make copy-data server=<host> buildout=<cfg>`), a 4.3 buildout with
   `collective.exportimport = 1.16` / `plone.restapi = 7.9.1`, then the
   sequence in `MIGRATION_DATA.md` §1 (export script) and §2 (import
   steps 1–11, incl. `@@import_pm_post_process`). Expect the dry run to
   reveal: unsupported value types in the extra state (logged as
   warnings at export), profile-package attributes missing from
   `extra_state.py` lists, and encoding edge cases in histories.
5. **D.4 deferred reactivations** (not cutover blockers): AMQP / scan_id
   (16 marked comment blocks), TinyMCE style formats, nightly tasks
   external trigger, async previews, webspellchecker decision.
6. **D.7 rollout**: nothing started.
7. **Upstream PRs** for the 13 dependency checkouts in `patches/src-wip/`.

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
