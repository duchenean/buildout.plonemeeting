# iA.Delib Plone 4 → 6 migration — TODO

Living checklist for the migration. Tick boxes as work lands; keep
the "Next session pickup" section at the top current. The full
strategy lives in [`PLONE6_MIGRATION_PLAN.md`](PLONE6_MIGRATION_PLAN.md);
features dropped during Stage A and queued for reimplementation
live in [`MIGRATION_REIMPLEMENT.md`](MIGRATION_REIMPLEMENT.md).

---

## Next session pickup

- [ ] **C.3** — Package rename (`Products.MeetingCommunes` → `plonemeeting.communes`).

---

## Stage A — Slim down ✅

**Done.** All 6 PRs merged. The 4.3 codebase shipped with no AMQP,
no SOAP, no CKEditor, no async runtime, no `cron4plone`, no
`communesplone.layout`. Reactivation tracker:
[`MIGRATION_REIMPLEMENT.md`](MIGRATION_REIMPLEMENT.md).

---

## Stage B — Finish AT → DX ✅

### B.1 — `MeetingConfig` ✅

**Done.** 8 PRs landed across 3 repos. DX schema, vocabularies,
default view ported, all callers swept, `plonemeeting.core` version
bumped to `6.0.0.dev0` and `plonemeeting.restapi` to `3.0.0.dev0`
(3.x line tracks PM 6.x, mirroring the existing 1.x→4.1.x /
2.x→4.2.x scheme). Punch list lives in
`MIGRATION_SUMMARY_MEETINGCONFIG.md`.

### B.2 — `MeetingItem` ✅

8-phase port mirroring the MeetingConfig recipe.

- [x] **B.2.0** — Schema declaration: `content/meetingitem.py` with
      `model.Schema` mirroring every AT field in snake_case. FTI XML
      for MeetingItem, MeetingItemTemplate, MeetingItemRecurring.
      `MIGRATION_SUMMARY_MEETINGITEM.md` created.
- [x] **B.2.1** — Bootstrap + FTI swap: DX class active, AT class
      kept as legacy. Dynamic FTI cloning copies DX properties
      (klass, schema_policy, behaviors) to profile-specific types.
- [x] **B.2.2** — Core module caller sweep (12 commits).
- [x] **B.2.3** — Browser layer sweep.
- [x] **B.2.4** — Test suite migration — 934/934 pass (6 pre-existing).
- [x] **B.2.5** — Templates.
- [x] **B.2.6** — Test suite aligned, DataGridField migrated where
      needed.
- [x] **B.2.7** — Subtypes (`MeetingItemTemplate`,
      `MeetingItemRecurring`) — already DX subclasses in
      `content/meetingitem.py`; FTI swap in `types.xml`. No work needed.
- [x] **B.2.8** — Final cleanup: rename stored config values
      camelCase→snake_case.

### B.3 — `ToolPloneMeeting` ✅

**Done.** 3 commits on `feature/B.3-toolplonemeeting-dx`:

- [x] **B.3.1** — Class swap from AT `OrderedBaseFolder` to
      `UniqueObject + OFS.OrderedFolder`. 12 fields stored as plain
      persistent snake_case attributes. `__getattr__` compat shim for
      external plugins. `InitializeClass` replaces `registerType`.
- [x] **B.3.2** — `IToolPloneMeeting` expanded to full zope.schema
      interface (12 fields, 3 DictRow row schemas). z3c.form `@@tool-edit`
      view with DataGridField widgets. Migration step in `migrate_to_4300`.
      Two new vocabularies (weekdays, defer_parent_reindex).
- [x] **B.3.3** — Caller sweep: ~87 AT-style `getX()`/`setX()` calls
      replaced with direct attribute access across 21 files. Helper
      methods renamed to snake_case. `__getattr__` shim kept for
      external plugin safety.

### B.4 — Delete the AT framework ✅

**Done.** 3 commits on `feature/B.4-drop-at-framework`:

- [x] **B.4.1** — Dropped AT framework imports from all active code
      (ToolPloneMeeting, browser, exportimport, setuphandlers,
      migrations, utils). Legacy AT class files (`Meeting.py`,
      `MeetingItem.py`, `MeetingConfig.py`, `MeetingUser.py`,
      `MeetingCategory.py`) retained for migration compatibility.
- [x] **B.4.2** — Updated test suite for AT removal. Fixed
      `Products.Archetypes` test imports, replaced AT test helpers
      with DX equivalents.
- [x] **B.4.3** — Fixed pre-existing test failures from AT→DX
      migration: template `usedAttrs` camelCase→snake_case alignment,
      vocabulary name fix, `UnicodeEncodeError` in `MeetingItem.Title()`,
      portal title viewlet test resilience.

`archetypes.schematuning` already commented out in `setup.py` and
`versions.cfg` (Stage A). Remaining AT imports are only in legacy AT
class files kept for migration readers.

---

## Stage C — Modernize and rename (still on Plone 4.3 / Py 2.7)

Goal: every line is **ready** for Py 3.12 / Plone 6.1, plus the
package rename has landed. Runtime stays on 4.3 throughout — Py3 is
caught by static analysis, runtime validation happens in Stage D.

### C.1 — Python 3 readiness (static-only) ✅

**Done.** 1 commit on `feature/B.4-drop-at-framework`:

- [x] `from __future__ import absolute_import, print_function` added
      to all 154 non-empty `.py` files (`unicode_literals` and
      `division` deliberately omitted).
- [x] 9 implicit relative imports → explicit (required by
      `absolute_import`).
- [x] 32 `iteritems`/`itervalues`/`iterkeys` → `items`/`values`/`keys`.
- [x] 7 old-style `except X, e:` → `except X as e:`.
- [x] ~25 dict view subscript accesses wrapped with `list()`.
- [x] 22 `basestring` → `six.string_types`, 29 `unicode()` →
      `six.text_type()` (19 files gained `import six`).
- [x] Test suite: 933/933 pass (2 pre-existing errors unrelated).

### C.2 — Buildout → pip / uv

- [ ] Replace `Makefile` + `buildout.cfg` chain with `pyproject.toml`
      + `requirements/*.txt` + a cookiecutter-plone style layout.
- [ ] Reimplement profile selection as `make profile=communes run`.
- [ ] Use `mxdev` for development checkouts (modern `mr.developer`).
- [ ] Keep the thin `Makefile` wrapper for muscle memory.

### C.3 — Package rename

- [x] `Products.PloneMeeting` → **`plonemeeting.core`** — full
      filesystem move, namespace declaration, every Python import,
      every ZCML directive, every GenericSetup XML reference, every
      page template reference. 681 files, 934/934 tests pass.
- [ ] `Products.MeetingCommunes` → **`plonemeeting.communes`** —
      same recipe, smaller surface. In lockstep with the
      `Products.PloneMeeting` rename so there's never a half-renamed
      state.
- [ ] `imio.pm.locales` translation domain decision: keep
      `PloneMeeting` to avoid a re-translation pass, or rename and
      re-translate. (See `MIGRATION_PLAN` §4.3.)

### C.4 — Pre-cutover freeze

- [ ] `pylint --py3k` zero errors on every package in `src/`.
- [ ] Tag pre-cutover release of `plonemeeting.core` and
      `plonemeeting.communes` so Stage D can be reproducibly built.
- [ ] Snapshot a sanitized prod ZODB + blobs (`make copy-data`) —
      the validation harness for Stage D.

---

## Stage D — Plone 6.1 Classic / Py 3.12 cutover

The single runtime jump. No intermediate Plone version. Static
analysis from Stage C meets reality here — expect a fix-up sprint.

### D.1 — Stand up the Plone 6.1 skeleton

- [ ] New `requirements/` pinned to Plone 6.1.x + Python 3.12.
- [ ] Use `cookiecutter-plone` (or equivalent) as layout reference;
      keep `plonemeeting.core` and `plonemeeting.communes` as src
      checkouts via `mxdev`.
- [ ] Plone 6.1 **Classic** theme. The 6 Classic UI is the only
      frontend we ship.
- [ ] Bring up an empty Plone 6.1 site with the two packages
      installed and the test profile applied.

### D.2 — Dependency bumps to Plone 6.1 lines

- [ ] `plone.restapi` → 9.x.
- [ ] `eea.facetednavigation` → 16.x. Faceted XML/JSON config files
      in `faceted_conf/` likely need small adjustments.
- [ ] `dexterity.localroles`, `dexterity.localrolesfield` → 2.x.
- [ ] `plone.app.versioningbehavior` → 2.x;
      `plone.formwidget.namedfile` → 3.x.
- [ ] `collective.documentgenerator` → 4.0 + `appy` POD (current iMio
      release) — both already P6.1/Py3 ready, straight pin bump.
- [ ] `collective.contact.{core,plonegroup,widget}`,
      `collective.eeafaceted.*`, `collective.iconifiedcategory`,
      `collective.dms.scanbehavior`,
      `collective.behavior.{internalnumber,talcondition}`,
      `collective.querynextprev`, `collective.messagesviewlet`,
      `collective.excelexport`, `ftw.labels` — bump to P6 release
      lines; port where no P6 release exists yet.
- [ ] `imio.{actionspanel,annex,helpers,history,prettylink,migrator,fpaudit,pyutils,pm.locales,restapi,webspellchecker}` → P6 lines.
- [ ] `plonetheme.imioapps` — verify P6.1-compatible release. If
      not, ship initially with stock Plone 6 Classic and port iMio
      styling as follow-up.
- [ ] **TinyMCE** stock — no plugin parity work (Stage A dropped
      CKEditor outright).

### D.3 — `imio.dashboard` decision

- [ ] (a) P6 fork of `imio.dashboard` exists and works → bump pin.
      OR (b) inline the remaining `imio.dashboard` features directly
      into `plonemeeting.core`. Single biggest schedule risk
      inside Stage D.

### D.4 — Reactivate Stage-A "comment, don't delete" features

Per [`MIGRATION_REIMPLEMENT.md`](MIGRATION_REIMPLEMENT.md), each of
these has commented code waiting to be brought back under the new
stack:

- [ ] **AMQP / scan_id integration** — verify `imio.zamqp.{pm,core}`
      have P6/Py3 releases; if not, port them. Re-add to
      `install_requires`, ZCML include, `instance-amqp` runtime.
- [ ] **CKEditor stack** — *not* coming back. Translate the
      commented `_configureCKeditor` `menuStyles` block (highlight
      colours, font sizes, table layouts, page-break) into TinyMCE
      `style_formats` config. Re-wire the AjaxSave / quick-edit
      hooks against TinyMCE if the UX is still wanted.
- [ ] **Scheduled tasks (cron4plone)** — Plone 6 will not use
      `<clock-server>`. Roll our own scheduler (system cron /
      Kubernetes CronJob / Celery beat). The view
      `@@pm-night-tasks` is preserved and remains callable; needs
      an external trigger.
- [ ] **Async preview generation** — reattach to whatever
      background-task model is adopted. The `JobRunner` event hook
      in `imio.annex/patch.py` is preserved as a comment.
- [ ] **`Products.PasswordStrength` decision** — kept on the 4.3
      line. Plone 6 ships its own password policy; configure the
      native one and drop our wired-in version.
- [ ] **`imio.webspellchecker` decision** — kept on the 4.3 line.
      Revisit once we know whether the deployment still pays for
      the SaaS subscription.

### D.5 — Iterate until tests pass

- [ ] `plonemeeting.core` test suite green on Plone 6.1 / Py 3.12.
      Expect non-trivial fix-up: lxml/BeautifulSoup string-vs-bytes
      drift, `DateTime` vs `datetime` boundaries, catalog query
      result type changes, browser-layer registration changes,
      workflow chain registration differences.
- [ ] `plonemeeting.communes` test suite green.
- [ ] `plonemeeting.restapi` integration tests green.

### D.6 — Data migration (`collective.exportimport`)

Long-term path: dump content from Plone 4.3 to JSON, fresh-install
Plone 6.1, import. Concrete mechanics designed at Stage D start,
working against the sanitized prod copy archived end of Stage C.

- [ ] Decide which `collective.exportimport` exporters to enable.
- [ ] Workflow-history strategy.
- [ ] Blob handling.
- [ ] References / relations strategy.
- [ ] Per-content-type migration scripts.

### D.7 — Production rollout

- [ ] Pilot on one profile (Communes) before the others
      (Charleroi/Liege/PROVHainaut/etc.).
- [ ] Maintain Plone 4.3 hotfix branch in parallel during a defined
      parallel-run period.
- [ ] Rollback plan: the ZODB from before cutover is the rollback
      (export/import is non-destructive on the source ZODB).

---

## Out of *minimal* scope (separate efforts)

- Profile packages other than `MeetingCommunes` (Charleroi, Liege,
  PROVHainaut, BEP, Mons, Namur, Seraing, Lalouviere, CPASLalouviere)
  — same Stage C–D rename + bump cycle once the pattern is set.
- New features or UX redesign.
- Replacing `appy` POD generation with anything else.
- Multi-tenant or any architectural change.

---

## Done definition

- [ ] One iMio customer runs `plonemeeting.core` +
      `plonemeeting.communes` on Plone 6.1 Classic / Py 3.12 in
      production.
- [ ] CI matrix is green on Py 3.12 / Plone 6.1 only (4.3 / Py 2.7
      retired).
- [ ] No `Products.Archetypes` import remains in `src/`.
- [ ] No package in `versions.cfg` requires Python 2.
- [ ] `Products.PloneMeeting` and `plonemeeting.communes` repos
      are archived; the new repos are the source of truth.
- [ ] A 4.3 hotfix branch exists, marked maintenance-only.
