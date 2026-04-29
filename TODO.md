# iA.Delib Plone 4 → 6 migration — TODO

Living checklist for the migration. Tick boxes as work lands; keep
the "Next session pickup" section at the top current. The full
strategy lives in [`PLONE6_MIGRATION_PLAN.md`](PLONE6_MIGRATION_PLAN.md);
features dropped during Stage A and queued for reimplementation
live in [`MIGRATION_REIMPLEMENT.md`](MIGRATION_REIMPLEMENT.md).

---

## Next session pickup

- [ ] Start **B.2.0 — MeetingItem DX schema declaration** (see
      below). Create `MIGRATION_SUMMARY_MEETINGITEM.md` alongside in
      the same PR.

---

## Stage A — Slim down ✅

**Done.** All 6 PRs merged. The 4.3 codebase shipped with no AMQP,
no SOAP, no CKEditor, no async runtime, no `cron4plone`, no
`communesplone.layout`. Reactivation tracker:
[`MIGRATION_REIMPLEMENT.md`](MIGRATION_REIMPLEMENT.md).

---

## Stage B — Finish AT → DX

### B.1 — `MeetingConfig` ✅

**Done.** 8 PRs landed across 3 repos. DX schema, vocabularies,
default view ported, all callers swept, `plonemeeting.core` version
bumped to `6.0.0.dev0` and `plonemeeting.restapi` to `3.0.0.dev0`
(3.x line tracks PM 6.x, mirroring the existing 1.x→4.1.x /
2.x→4.2.x scheme). Punch list lives in
`MIGRATION_SUMMARY_MEETINGCONFIG.md`.

### B.2 — `MeetingItem` (~8.5 kLOC, the biggest piece)

7-phase port mirroring the MeetingConfig recipe. The first phase is
hand-crafted; the rest are mechanical caller sweeps using the
`at-to-dx-caller-sweep` skill.

- [ ] **B.2.0** — Schema declaration: write `content/meetingitem.py`
      with `model.Schema` mirroring every AT field in snake_case.
      Register via ZCML + FTI XML. **Hand-crafted, foundational PR.**
      Start with a fresh `MIGRATION_SUMMARY_MEETINGITEM.md`.
- [ ] **B.2.1** — Bootstrap: keep AT `MeetingItem` class registered
      as legacy alongside the DX class so the test layer can stand
      both up. Mirror what the MeetingConfig migration did
      (compatibility shims + bridge interfaces).
- [ ] **B.2.2** — Migrate accessor calls in core modules
      (`events.py`, `utils.py`, `adapters.py`, `vocabularies.py`,
      `indexes.py`, `MeetingConfig.py`, `Meeting.py`,
      `ToolPloneMeeting.py`). Mechanical — use the
      `at-to-dx-caller-sweep` skill.
- [ ] **B.2.3** — Migrate accessor calls in browser layer
      (`browser/views.py`, `browser/overrides.py`, others). Same
      pattern as B.2.2.
- [ ] **B.2.4** — Migrate the test suite (`tests/testMeetingItem.py`,
      `testWFAdaptations.py`, `testViews.py`, etc.). Watch for
      side-effect setters that need explicit
      `notify(ObjectModifiedEvent(item))`.
- [ ] **B.2.5** — Migrate templates (`browser/templates/*.pt`,
      `skins/plonemeeting_templates/*.pt` — the `meetingitem_view.pt`
      and `meetingitem_edit.pt` are the big ones).
- [ ] **B.2.6** — Replace `Products.DataGridField` (AT) with
      `collective.z3cform.datagridfield` for grid-style fields on
      MeetingItem. Substantive — adapt validators, widget
      configurations, and any `getRow*` accessor patterns.
- [ ] **B.2.7** — Subtypes (`MeetingItemTemplate`,
      `MeetingItemRecurring`) re-derive cleanly from the DX class.
- [ ] **B.2.8** — Final cleanup: scrub `MeetingItem.py` self-references
      that are now redundant; fix any drift in
      `MIGRATION_SUMMARY_MEETINGITEM.md`; document
      `getCustomFields(2)`-equivalent decisions for downstream
      packages.

### B.3 — `ToolPloneMeeting` (~1.8 kLOC)

- [ ] Move scalar configuration (booleans, strings, list-of-strings)
      onto a `plone.registry` schema; expose via Plone control panel.
- [ ] Keep containment behaviour by making the tool a Dexterity
      folder (so `MeetingConfig`s and other contained items remain
      reachable at the same path).
- [ ] Update every `getToolByName(self, 'portal_plonemeeting')` /
      `api.portal.get_tool('portal_plonemeeting')` call site to a new
      accessor pattern (small helper in `plonemeeting.portal.utils`
      that hides the rebinding).
- [ ] Test: control-panel form lets administrators edit the
      registry-backed settings; contained `MeetingConfig`s still at
      their existing path.

### B.4 — Delete the AT framework

- [ ] Confirm no `from Products.Archetypes` imports remain anywhere
      in `src/`.
- [ ] Drop `archetypes.schematuning` and
      `archetypes.referencebrowserwidget` from
      `versions.cfg` and `install_requires` (already commented in
      Stage A — convert from comment to deletion here).
- [ ] Verify the test suite is green on Plone 4.3 / Py 2.7 with
      zero AT.

---

## Stage C — Modernize and rename (still on Plone 4.3 / Py 2.7)

Goal: every line is **ready** for Py 3.12 / Plone 6.1, plus the
package rename has landed. Runtime stays on 4.3 throughout — Py3 is
caught by static analysis, runtime validation happens in Stage D.

### C.1 — Python 3 readiness (static-only)

- [ ] `pyupgrade --py27-plus` then `pyupgrade --py3-plus` (the
      latter as a *check*).
- [ ] `python -m pylint --py3k` clean across all `src/` packages
      (the canonical Py3-readiness check).
- [ ] `flake8 --select=B,C,E,W,F` plus `flake8-modern` if available.
- [ ] Add `from __future__ import absolute_import, division,
      print_function, unicode_literals` to every `.py`.
- [ ] Manual audit: `dict.has_key`, `iteritems`/`itervalues`/
      `iterkeys`, `xrange`, `unicode`, `basestring`, `print`
      statements, `except E, e` form, octal literals (`0755` →
      `0o755`), tuple-unpack in lambdas, relative imports,
      bytes/str discipline, `__cmp__` → `__eq__`/`__lt__`/
      `functools.total_ordering`, dict ordering assumptions.

### C.2 — Buildout → pip / uv

- [ ] Replace `Makefile` + `buildout.cfg` chain with `pyproject.toml`
      + `requirements/*.txt` + a cookiecutter-plone style layout.
- [ ] Reimplement profile selection as `make profile=communes run`.
- [ ] Use `mxdev` for development checkouts (modern `mr.developer`).
- [ ] Keep the thin `Makefile` wrapper for muscle memory.

### C.3 — Package rename

- [ ] `Products.PloneMeeting` → **`plonemeeting.portal`** — full
      filesystem move, namespace declaration, every Python import,
      every ZCML directive, every GenericSetup XML reference, every
      page template reference. One focused PR with a re-runnable
      script checked in.
- [ ] `Products.MeetingCommunes` → **`plonemeeting.communes`** —
      same recipe, smaller surface. In lockstep with the
      `Products.PloneMeeting` rename so there's never a half-renamed
      state.
- [ ] `imio.pm.locales` translation domain decision: keep
      `PloneMeeting` to avoid a re-translation pass, or rename and
      re-translate. (See `MIGRATION_PLAN` §4.3.)

### C.4 — Pre-cutover freeze

- [ ] `pylint --py3k` zero errors on every package in `src/`.
- [ ] Tag pre-cutover release of `plonemeeting.portal` and
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
      keep `plonemeeting.portal` and `plonemeeting.communes` as src
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
      into `plonemeeting.portal`. Single biggest schedule risk
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

- [ ] `plonemeeting.portal` test suite green on Plone 6.1 / Py 3.12.
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

- [ ] One iMio customer runs `plonemeeting.portal` +
      `plonemeeting.communes` on Plone 6.1 Classic / Py 3.12 in
      production.
- [ ] CI matrix is green on Py 3.12 / Plone 6.1 only (4.3 / Py 2.7
      retired).
- [ ] No `Products.Archetypes` import remains in `src/`.
- [ ] No package in `versions.cfg` requires Python 2.
- [ ] `Products.PloneMeeting` and `Products.MeetingCommunes` repos
      are archived; the new repos are the source of truth.
- [ ] A 4.3 hotfix branch exists, marked maintenance-only.
