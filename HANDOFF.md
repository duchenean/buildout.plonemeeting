# Session handoff — 2026-07-03 (Stage D: D.5 residuals + D.6 kickoff)

Context for the next session (human or LLM). Read this together with
[`TODO.md`](TODO.md) and [`MIGRATION_DATA.md`](MIGRATION_DATA.md).
Branch everywhere: `feature/D-plone6-cutover` (buildout),
`feature/D-plone6-cutover` (plonemeeting.core), `plone6`
(plonemeeting.restapi).

## What landed this session (committed)

Buildout repo:
- `b0ec71c` TODO.md Stage D checkbox sync (D.1–D.3 done, D.4 partial).
- `5c8bd62` D.6 wiring: `collective.exportimport = 1.16` pinned + in
  instance/test eggs; `zc.buildout = 4.1.12` pin (4.2.0 self-upgrade
  conflicts with requirements.txt); `always-checkout = false` in dev.cfg
  (base.cfg's `force` merges origin over local src WIP — it left
  dexterity.localrolesfield mid-merge, aborted with `git merge --abort`);
  `make uno-venv` + `port.cfg python-uno = var/uno-venv/bin/python3`
  (appy converter needs a python with BOTH `uno` and `appy`);
  `MIGRATION_DATA.md` runbook. Plus `ijson` pin + Makefile LO note.

plonemeeting.core:
- `81bcca8fe` **D.6 milestone 1**: `migrations/p4top6/` —
  collective.exportimport import hooks. Complete AT→DX field maps
  (MeetingItem 72, MeetingConfig 153 — incl. 20 fields MISSING from
  MIGRATION_SUMMARY_MEETINGCONFIG.md and `budgetDefault` which that doc
  *wrongly* says was removed), DataGrid row-key remaps
  (`signatureNumber`, `insertingMethod` — the only 2 of 13 grids that
  differ), plain-text unwrap, `@@import_pm_manually_linked_items`,
  `@@import_pm_tool_settings`. ZCML condition-loaded. Unit tests:
  `tests/testP4ToP6Migration.py` (9 tests, green via `bin/test`).
- `e9ce1e21a` D.5: two cross-module test-state leaks fixed
  (testToolPloneMeeting pmCreator2→developers_observers +
  groups_in_charge; testSearches pmReviewer2 group swap) + py3 bytes
  assert in test_pm_ItemExportPDFForm.
- `96478c909` D.5: previous session's WIP committed (MeetingItem DX
  fieldsets + add/edit forms + testForms.py), validated by full suite.

plonemeeting.communes: `9026aca` (ignore testP4ToP6Migration.py in
VerifyTestFiles), `b884b3a` (mirror testForms.py).

## Test status

- **plonemeeting.communes full suite: 939 tests, 4 failures + 1 error**
  (log: see below). The error and 4 failures are understood — see open
  threads 1 and 2. A 5-module slice (testSearches→testWorkflows) runs
  **200/200 green**, and test_pm_ItemExportPDFForm is green when
  LibreOffice is up.
- **plonemeeting.restapi: 95 tests, was 49F+45E, now 5F+19E** after a
  big uncommitted sweep (open thread 3).

## Open threads (in priority order)

### 1. Third test-ordering leak (the remaining 4 communes failures)

The 4 failures (testUtils SendMailIfRelevantIsPermission, testViews
ItemMoreInfosNotViewableItem[TALExpr], testWorkflows
WholeDecisionProcess) are all "pmCreator2/pmReviewer2 unexpectedly has
View on a developers item". Two leaks were fixed (commit `e9ce1e21a`)
and verified on the 5-module slice — so a THIRD leak lives in a module
alphabetically before testSearches.

**Prime suspect, investigation was mid-flight here**:
`testMeetingItem.test_pm_ItemTemplateDefaultProposingGroup`
(src/plonemeeting.core/.../tests/testMeetingItem.py:6866-6935+). It
does, with NO cleanup at test end:
- `self._select_organization(self.endUsers_uid)` (plonegroup registry)
- `self._addPrincipalToGroup('pmCreator2', self.endUsers_creators)`
- `person1.userid = 'pmCreator2'` + `primary_organization`
- `self.developers.groups_in_charge = (self.vendors_uid,)` etc. —
  **groups_in_charge on 3 orgs, never reset** (the exact mechanism of
  the leak fixed in testToolPloneMeeting: a developers item then grants
  View to the vendors group-in-charge observers).

Fix pattern (copy from commit `e9ce1e21a`): at test end, reset
`groups_in_charge = ()` on developers/vendors/endUsers, remove
pmCreator2 from endUsers_creators, deselect endUsers org, reset
person1.userid/primary_organization. Then check the tail of the test
(read past line 6935) for more mutations, and re-grep other pre-
testSearches modules for the same pattern
(`grep -n "groups_in_charge = \|_addPrincipalToGroup" tests/*.py`).

**Verify** with modules in suite order (~10 min):
`bin/testmc --layer='!.*Robot.*' -m '.*(testMeetingItem|testSearches|testToolPloneMeeting|testUtils|testViews|testWorkflows)$'`
then the full suite (~40 min).

### 2. LibreOffice must be running for the appy tests

test_pm_ItemExportPDFForm needs a LibreOffice server on :2002 that
version-matches the HOST python-uno bindings (LO 26.2 here). The docker
image (LO 7.3) is incompatible → "Binary URP bridge disposed". Use
`make libreoffice-local` (host soffice) in a persistent terminal, or
daemonize it, before test runs. The converter python is
`var/uno-venv/bin/python3` (rebuild with `make uno-venv` after
`make cleanall`). The final gate run failed this test only because the
host soffice had died — it is green when LO runs.

### 3. plonemeeting.restapi P6 port — large UNCOMMITTED sweep

A subagent swept plonemeeting.restapi (py2 leftovers + AT→DX callers +
plone.restapi 9 API drift): 94 red → 24 red. **All uncommitted** on
branch `plone6`: 34 files, +660/−443. Highlights: serializers rebased
on DX with an external camelCase JSON-contract mapping (`_dx_to_at`),
new `deserializer/dxcontent.py`, `_dx_aware_add` shim in services/add,
testing.py layers ported (PLONE_RESTAPI_DX + `zope.WSGI_SERVER_FIXTURE`
instead of the removed AT layer; the redundant restapi fixture was
dropped — it conflicts with the PM fixture), testing profile dependency
renamed to `profile-plonemeeting.core:testing`.

Also uncommitted in plonemeeting.core (from me + the agent):
- configure.zcml: **re-enabled MeetingItemWorkflowConditions/Actions
  adapter registrations** (classes still live in legacy MeetingItem.py;
  same pattern communes uses; cleared 16 of the restapi errors and is
  needed by anything using core's own testing profile).
- content/meeting.py, content/meetingitem.py,
  profiles/default/types/annexDecision.xml: small agent fixes
  (~18 lines; the agent's last words were that an insert-items bug fix
  made "30/30 core InsertItem tests pass" — REVIEW these diffs before
  committing, they were not independently verified here).
- imio.restapi src checkout also has small uncommitted P6 fixes
  (5 files — that package already carries local P6 WIP; per project
  convention do NOT commit there).

**The subagent died on the org's monthly API spend limit** mid-
iteration, right before re-running the suite. Next step: review
`git diff` in plonemeeting.core + plonemeeting.restapi, run
`bin/testrestapi --layer='!.*Robot.*'` (last known: 5F+19E, clusters:
attendees ×7, search meetings ×7, delete ×2, add ×2, get_uid ×4 — one
of them, test_restapi_search_base_search_uid, is a full-suite-only
ordering leak), keep iterating, then commit in logical units.

### 4. D.6 remaining work

Milestone 1 (import hooks + runbook) is committed. Still open, per
MIGRATION_DATA.md "Open points": advice-annotations export (annotations
are NOT exported by default — needs a hook pass), faceted config
re-application, CMFEditions versions decision, and an end-to-end dry
run against a real 4.3 export (needs a prod copy or a 4.3 buildout —
none exists locally; `make copy-data` can snapshot one).

## Environment gotchas discovered (all fixed, for awareness)

- `make buildout` deletes `.installed.cfg` BEFORE running buildout: a
  failed run leaves a half-broken tree; rerun
  `bin/python bin/buildout` (with `buildout:always-checkout=false` if
  needed) rather than re-making from scratch.
- The venv must NOT contain a pip-installed Zope stack (conflicts with
  buildout pins). `make cleanall && make buildout` gives a clean venv.
- Robot tests are never run: `--layer='!.*Robot.*'` always.
- Test logs: tee to scratchpad and grep — never dump full logs.

## Logs from this session (scratchpad, may be gone next session)

`/tmp/claude-1000/-home-aduchene-Projects-iMio-pm-next/99fa4736-aae6-4221-9383-76120ace5f2b/scratchpad/`:
`testmc-full.log` (baseline 939), `testmc-final.log` (final gate),
`ordering-verify.log` (5-module green), `restapi7.log` (restapi 5F+19E).
