# iA.Delib Plone 4 → 6 migration — TODO

Living checklist for the migration. Tick boxes as work lands; keep
the "Next session pickup" section at the top current. The full
strategy lives in [`PLONE6_MIGRATION_PLAN.md`](PLONE6_MIGRATION_PLAN.md);
features dropped during Stage A and queued for reimplementation
live in [`MIGRATION_REIMPLEMENT.md`](MIGRATION_REIMPLEMENT.md).

---

## Next session pickup

**Read [`HANDOFF.md`](HANDOFF.md)** — full state of the 2026-09-21 session.

- D.1–D.3 done, D.4 partial, **D.5 done on all packages** (communes
  939/0F/1E env-only, restapi 95/95, core `testToolPloneMeeting` 40/40,
  `testP4ToP6Migration` 21/21), **D.6 code complete** (only the
  end-to-end dry run against a prod copy is left).
- `src/plonetheme.imioapps` is back: rewritten from scratch on branch
  `plone6` (duchenean fork, see `sources.cfg`); no blocker left.
- **D.5bis front-end fixes landed 2026-09-21** (bundles, modal port,
  icons, jqueryui); see its "Still to do" list, then (1) D.6 dry run
  (needs `make copy-data`), (2) D.4 reactivations, (3) D.7 pilot.
- **D.5ter**: the chrome now follows the design mockups. The footer text
  is hardcoded in the theme and needs a viewlet — see the section.

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

### ~~C.2 — Buildout → pip / uv~~ (dropped)

Buildout works fine with Plone 6.1 — no need to migrate the build
system as a prerequisite. Keep the existing `zc.buildout` +
`mr.developer` setup through the cutover.

### C.3 — Package rename

- [x] `Products.PloneMeeting` → **`plonemeeting.core`** — full
      filesystem move, namespace declaration, every Python import,
      every ZCML directive, every GenericSetup XML reference, every
      page template reference. 681 files, 934/934 tests pass.
- [x] `Products.MeetingCommunes` → **`plonemeeting.communes`** —
      full namespace rename, 578 files, PROJECTNAME updated,
      934/934 tests pass.
- [x] `imio.pm.locales` translation domain decision: **keep
      `PloneMeeting`** — renaming would require re-translating every
      `.po` file for zero functional benefit. Domain is internal
      plumbing, not user-visible.

### C.4 — Pre-cutover freeze ✅

- [x] `pylint --py3k` zero errors on `plonemeeting.core` and
      `plonemeeting.communes` — 129 fixes total, 10.00/10 score,
      934/934 tests pass.
- ~~Tag pre-cutover release~~ — skipped, not useful.
- ~~Snapshot prod ZODB~~ — skipped, not useful.

---

## Stage D — Plone 6.1 Classic / Py 3.12 cutover

The single runtime jump. No intermediate Plone version. Static
analysis from Stage C meets reality here — expect a fix-up sprint.

### D.1 — Stand up the Plone 6.1 skeleton ✅

**Done** (commit `6681338`).

- [x] Update `versions.cfg` pins and `base.cfg` recipes to their
      Plone 6.1.x / Python 3.12 equivalents. Keep existing buildout
      layout with `mr.developer` src checkouts.
- [x] Plone 6.1 **Classic** theme. The 6 Classic UI is the only
      frontend we ship.
- [x] Bring up an empty Plone 6.1 site with the two packages
      installed and the test profile applied.

### D.2 — Dependency bumps to Plone 6.1 lines ✅

**Done** — pins landed in `versions.cfg`; packages without a P6
release are checked out in `src/` on `python3`/p6-compat branches.

- [x] `plone.restapi` → 9.x.
- [x] `eea.facetednavigation` → 16.x. Faceted XML/JSON config files
      in `faceted_conf/` likely need small adjustments.
- [x] `dexterity.localroles`, `dexterity.localrolesfield` → 2.x.
- [x] `plone.app.versioningbehavior` → 2.x;
      `plone.formwidget.namedfile` → 3.x.
- [x] `collective.documentgenerator` → 4.0 + `appy` POD (current iMio
      release) — both already P6.1/Py3 ready, straight pin bump.
- [x] `collective.contact.{core,plonegroup,widget}`,
      `collective.eeafaceted.*`, `collective.iconifiedcategory`,
      `collective.dms.scanbehavior`,
      `collective.behavior.{internalnumber,talcondition}`,
      `collective.querynextprev`, `collective.messagesviewlet`,
      `collective.excelexport`, `ftw.labels` — bump to P6 release
      lines; port where no P6 release exists yet.
- [x] `imio.{actionspanel,annex,helpers,history,prettylink,migrator,fpaudit,pyutils,pm.locales,restapi,webspellchecker}` → P6 lines.
- [x] `plonetheme.imioapps` — verify P6.1-compatible release. If
      not, ship initially with stock Plone 6 Classic and port iMio
      styling as follow-up.
- [x] **TinyMCE** stock — no plugin parity work (Stage A dropped
      CKEditor outright).

### D.3 — `imio.dashboard` decision ✅

**Done** — option (a): `imio.dashboard` ported for Plone 6 on the
`python3` branch of the src checkout (imports fixed, obsolete
upgrades ignored, `eea.faceted.vocabularies` migration).

- [x] (a) P6 fork of `imio.dashboard` exists and works → bump pin.
      OR (b) inline the remaining `imio.dashboard` features directly
      into `plonemeeting.core`. Single biggest schedule risk
      inside Stage D.

### D.4 — Reactivate Stage-A "comment, don't delete" features (partial)

Decisions are made; reimplementation of AMQP / TinyMCE styles /
scheduler trigger remains as follow-up (not cutover blockers).

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
- [x] **`Products.PasswordStrength` decision** — dropped; Plone 6
      native password policy is used (pin and install_requires
      commented out).
- [ ] **`imio.webspellchecker` decision** — kept on the 4.3 line.
      Revisit once we know whether the deployment still pays for
      the SaaS subscription.

### D.5 — Iterate until tests pass

- [x] `plonemeeting.core` test suite green on Plone 6.1 / Py 3.12
      (exercised via the communes full suite, which extends core).
- [x] `plonemeeting.communes` test suite green — 939 tests, 0 failures,
      0 errors (with LibreOffice up for the appy PDF test); re-verified
      2026-09-21 after the import-step ordering fix (939/0F/1E, the error
      being the appy PDF test without LibreOffice).
- [x] `plonemeeting.restapi` integration tests: 95/95 green. The two
      residuals were core bugs: item attribute titles built from a
      synthetic msgid (`get_dx_attrs`), and the `PloneMeeting-postInstall`
      import step racing the `workflow` step (GenericSetup sorts
      unconstrained steps from a set → PYTHONHASHSEED-dependent).

### D.5bis — Front-end resources on Plone 6 (browser audit 2026-09-21)

Plone 6 ignores `jsregistry.xml` / `cssregistry.xml`, so every script that
was only registered there was silently absent. Fixed 2026-09-21 (core commit
+ WIP in the dependency checkouts, snapshots in `patches/src-wip/`):

- [x] **PloneMeeting's own JS/CSS** moved to `browser/static/` (served as
      `++resource++plonemeeting.core/…`), registered as bundles
      `plonemeeting-vars`, `plonemeeting`, `plonemeeting-popups` in
      `registry.xml`. Skin-layer files cannot be bundles (FSFile is not
      callable by the resource viewlet: whole site 500s). `plonemeeting.css`
      ported from DTML to plain CSS (Bootstrap/theme custom properties,
      image URLs `../../<img>` relative to the webresource URL).
      `plonemeeting_styles` skin layer dropped. `jsregistry.xml` and
      `cssregistry.xml` deleted. Profile 4300 → **4301**, `migrate_to_4301`
      re-imports the bundle records of core + dependencies, cleans the bundle
      registry and removes the obsolete skin layers (old theme +
      `plonemeeting_styles`). Ran green on the dev site.
- [x] **Dependency bundles** (WIP, not committed there): `imio.actionspanel`
      (`actionspanel`, `actionspanel-vars`), `ftw.labels` (`ftw-labels`,
      `ftw-labels-select2`), `imio.annex` (`imio-annex-quickupload`),
      `imio.dashboard` (`imio-dashboard`), `collective.js.iframeresizer`.
- [x] **`collective.eeafaceted.collectionwidget` / `dashboard`**: new
      `profiles/plone6/` (`zcml:condition="have plone-60"`, z3ctable
      pattern), bundles on `++resource++` paths, `depends` on eea's
      `faceted.view` / `faceted.edit` (eea 16.4 names), profile versions
      3 → 4 and 1 → 2 with `upgradeDepends` on `plone.app.registry`.
- [x] **eea bundles forced synchronous**: eea 16.4 ships `faceted.*` with
      `load_async`/`load_defer` True, so `Faceted` was undefined in our
      document-ready handlers. Core `registry.xml` overrides the three
      records to False (comment explains why).
- [x] **collective.js.jqueryui 2.2.0** now an auto-checkout
      (`sources.cfg`/`dev.cfg`), `tpl % plugin` fix in `resources.py`
      (upstream master still broken). 31 KeyErrors/request and the 76
      datepicker TypeErrors are gone; fancytree initialises.
- [x] **Plone 4 skin icons** → Bootstrap icons (`++plone++bootstrap-icons/…`)
      in ~20 core templates, `overrides.py`, `content/meetingitem.py`,
      `collective.iconifiedcategory`, `imio.actionspanel` templates.
      Object-action icon names (`plone-redirection`) resolved through
      `@@iconresolver/<name>` in `imio.actionspanel/browser/views.py`.
- [x] **Overlays → `pat-plone-modal`**: helper `imio_modal()` /
      `imio_modal_form()` / `imio_modal_trigger()` in
      `imio.helpers/browser/static/helpers.js` (events `after-render`,
      `shown`, `hidden`; cancel button → `modalFunction: 'hide'`; ajax
      submit closes then refreshes faceted or reloads; `redirect: true`
      follows the response; `submit: 'helper'` for `submitFormHelper`,
      `'native'` for downloads). Ported: `plonemeetingpopups.js` (all
      prepOverlay calls, CKEditor code removed), `actionspanel.js`
      (`initializeOverlays`, `applyWithComments` trigger lookup),
      `batch_actions.js`, `imio.dashboard.js`, `ftw-labels.js`,
      `helpers.js` `infoOverlays`. `submitFormHelper` uses
      `tinymce.triggerSave()`.
- [x] Cookie helpers `createCookie`/`readCookie` (Plone 4 skin script) added
      to `plonemeeting.js`.

**Verified** on a private instance (port 8091, same ZEO): dashboard renders
with theme + PM CSS, all bundles load in dependency order, no `Faceted`
errors, PM/actionspanel/batchactions functions defined, `Faceted.Widgets`
has 13 widgets, `testP4ToP6Migration` 21/21 with the new profile files.

**Second pass (2026-09-21, later): click tests with a headless Chrome
harness** (`tools/browser-checks/`, Playwright, private instance on
`localhost:8091`; `127.0.0.1` is on the diazo hostname blacklist so the
theme is off there). Done:

- [x] `qq is not defined` / `PloneQuickUpload is not defined`: the
      `collective.quickupload` profile was not installed on P6. Kept (decision
      2026-09-21: mockup `pat-upload` has no per-file title/category form, a
      port would be a UX rewrite). `imio.annex` metadata now depends on
      `profile-collective.quickupload:default`, the old `_configureQuickupload`
      property values are registry records in core `registry.xml`,
      `migrate_to_4301` installs the product on existing sites, prod pin
      bumped to 2.0.0a1 (first P6 release; the master checkout adds Py3 fixes).
      Bundle order: `imio-annex-quickupload` depends on
      `collective.quickupload.helpers`; the `qq._addSelection` override in
      `imio.helpers/helpers.js` runs at document ready with a `typeof qq`
      guard.
- [x] Collection widget `c1` not in `Faceted.Widgets`: eea 16 fires
      `INITIALIZE` from its own document-ready handler, so a handler bound
      inside a later ready handler misses it. `collectionwidget/widgets/view.js`,
      `collective.z3cform.select2` `select2-view.js` and the `custom_b_start`
      handler in `plonemeeting.js` now bind when the script loads. 14/14
      widgets register.
- [x] `collective.z3cform.select2` had no P6 bundles (`initializeSelect2SingleWidget`
      undefined in the quick upload form): new `profiles/plone6/` registered as
      `default` under `have plone-60` (bundles `select2-widget`,
      `faceted-select2-view`, select2 3.4.8 comes from `ftw-labels-select2`),
      added to `BUNDLE_PRODUCTS` of `migrate_to_4301`.
- [x] Popups clicked: history (bound on every page now, `contentHistory()`
      in the popups ready block), add annex, quick upload (real upload of a
      file through the modal creates the annex with its category), batch
      action "Changer l'état" (opens, cancel closes). Plone 6.1 modal markup
      is `.modal-wrapper .modal.show`, not `.plone-modal`.
- [x] Quick upload chain fixes: `imio.annex` `quick_upload.pt` dropped the
      P4 `global_defines` macro; `request.get('SESSION')` is `None` without
      configured sessions (`or {}` in quickupload + imio.annex);
      `pretty_title_or_id` skin script → `Products.CMFPlone.utils`
      function (both packages); plone.protect: the uploader now posts the
      `_authenticator` token (hidden input in `quick_upload.pt`, param in
      `sendDataAndUpload`); the quick upload modal shows `.quick-uploader`
      (`content` option, `submit: 'native'`); annex unlock on `hidden` only
      for `/edit` links.
- [x] No `<base>` tag on Plone 6: the batch action forms posted to a
      relative URL that resolved to the parent folder (404). Form action is
      absolute in `collective.eeafaceted.batchactions` viewlet.
- [x] `imio.webspellchecker` viewlet rendered `<script src="?t=…">` when
      `js_bundle_url` is empty (the page loaded itself as a script,
      `Unexpected token '<'` on every page). Viewlet renders nothing without
      a bundle URL.
- [x] Remaining Plone 4 skin images: `spinner_small.gif` (actions panel
      async placeholder → Bootstrap spinner; `imio.annex` preview status →
      `hourglass-split.svg`), `file_icon.png` (annex/annexDecision FTI icons
      and preview → `file-earmark.svg`), `download_icon.png` (FTI download
      action → `download.svg`). `imio.actionspanel` keeps `++plone++…` icon
      paths (it kept only the last segment).
- [x] `AnnexActionsPanelView.showHistoryForContext` walked up parents until
      `__class__.__name__` was `MeetingItem`/`Meeting`: never true for the DX
      `MeetingItemRecurring`, crashed the annexes page. Dead walk removed.

**Still to do / not verified:**

- [ ] Class-name checks that miss the DX item subclasses
      (`MeetingItemTemplate`, `MeetingItemRecurring`; the AT class was
      `MeetingItem` for all three types): `vocabularies.py` 611 (groups in
      charge stored terms), 1992 and 2009 (annex category vocabularies,
      `cfg` lookup), `adapters.py` 1935-1955 (annex viewability through
      linked items), `utils.py` `getCurrentMeetingObject`. Replace with
      `isinstance` or a class-name tuple, with tests.
- [ ] Popups not exercised (the dev items are all presented, so the links
      were absent): actions panel transition with comment
      (`applyWithComments`), duplicate item (`redirect: true`), PDF export
      (needs LibreOffice), advice add/edit, attendees forms
      (`onsuccessManageAttendees`). Create an item in creation state on the
      dev site and run `tools/browser-checks/popups_check2.js` against it.
- [ ] Theme layout (D.5ter, theme session): on dashboards the searches
      column (`.faceted-tagscloud-collection-widget` portlet,
      `#portal-column-one`) stacks above the content instead of beside it;
      Plone's folder actions render as a button row under the table; on
      item pages the searches portlet is an unstyled bullet list.
- [ ] Rich text quick-edit (`initRichTextField`, `saveCKeditor`… in
      `plonemeeting.js`) still calls CKEditor → D.4 TinyMCE item; the
      pencil icon on rich fields is visible but the action will throw.
- [ ] `collective.js.tablednd` (meeting items drag & drop, `tableDnD`) is
      excluded (removed `includeDependencies` directive): D.4 item.
- [ ] `plone.formwidget.masterselect` widget JS and
      `collective.contact.widget` still look up `.overlay-ajax` (P4 overlay
      DOM); harmless until used inside a modal.
- [ ] `Migrator._before_reinstall` / `_after_reinstall` read
      `portal_properties.ckeditor_properties`: any migration calling
      `reinstall()` fails on P6 (CKEditor dropped). Guard or drop.
- [ ] User's `bin/instance1` must be **restarted** (new ZCML: resource dir,
      plone6 profiles, jqueryui checkout, select2 plone6 profile). Until then
      it logs "Could not find resource ++resource++plonemeeting.core/…" and
      has no PM JS (as before). CMFPlone caches the rendered resource list per
      process: registry changes made from another process need a restart.
- [ ] Dependency WIP is uncommitted in `src/` (convention); snapshots in
      `patches/src-wip/*.patch` (13 packages, incl. new
      `collective.quickupload`, `imio.webspellchecker`,
      `collective.z3cform.select2`). Upstream PRs still to open.

### D.5ter — Skin against the design mockups

The chrome of `plonetheme.imioapps` is built against the claude.ai design
project `ee8a1aa9-cd68-4df6-adea-d3c79d95acf7` ("iA.Délib - Skin Plone 6",
boards `Chrome A.html` and `Meeting Item Redesign.html`). Top bar, message
band, breadcrumb, left rail, count chips and footer match it; the items
below are the parts the markup cannot supply yet.

- [ ] **Footer text is hardcoded in `theme/index.html`** — the name of the
      application (`iA.Délib · Gestion des délibérations`), the
      `Documentation` link (`https://docs.imio.be/`) and the release
      (`Version 6.0.1.2 build 33155716910.64.1`). None of the three is
      translatable and the release is a literal from the mockup, so it
      reads wrong on every site. A viewlet in `plonemeeting.core` must
      supply them, with the release read from the distribution.
- [ ] **Breadcrumb prefix** — the mockup opens the crumb line with
      `Vous êtes ici :`. Plone 6 dropped it. It needs an override of the
      `plone.path_bar` viewlet for a translatable string; Diazo and CSS
      cannot add one.
- [ ] **Rail header shortcuts on the to-do portlet** — the mockup gives
      both rail headers the home and settings icons. Only
      `portlet_plonemeeting.pt` renders them; `portlet_todo.pt` has a bare
      `dt.portletHeader`.
- [ ] **Accent searches in the rail** — the mockup marks a saved search
      that needs attention (`.mi-rail-item.is-accent`). The faceted widget
      exposes no such state.
- [ ] **Content column** — the mockup stacks cards straight on the page
      field; the theme still wraps every view in one white `#content`
      card. Dropping the wrapper means every Plone view supplies its own
      cards, which belongs with the item and configuration page redesign.
- [ ] **Bottom gutter** — the mockup leaves 80px under the content to
      clear its floating action bar. The theme leaves 20px, because it
      ships no such bar yet.

Reference render for measuring a component against the mockup: rebuild it
as a static page from `ds/colors_and_type.css` + the component block of
`ds/meeting-item.css` + the markup of the `.jsx`, serve it, and compare
`getComputedStyle` numbers rather than screenshots.

### D.6 — Data migration (`collective.exportimport`)

Long-term path: dump content from Plone 4.3 to JSON, fresh-install
Plone 6.1, import. Runbook: [`MIGRATION_DATA.md`](MIGRATION_DATA.md).
Code: `plonemeeting.core/.../migrations/p4top6/` (import hooks,
`extra_state.py` codec, `export_p43.py` for the 4.3 side,
`@@import_pm_*` views), tests in `testP4ToP6Migration.py`.

- [x] Decide which `collective.exportimport` exporters to enable —
      content via `export_p43.py` (+ `pm_extra_state`), then relations,
      members, localroles, ordering, defaultpages, redirects; portlets
      to review; tool settings via a debug-prompt dump.
- [x] Workflow-history strategy — carried by c.e.i as-is; CMFEditions
      versions dropped (no caller creates them any more).
- [x] Blob handling — blob paths (`include_blobs=2`) resolved against the
      old blobstorage (`COLLECTIVE_EXPORTIMPORT_BLOB_HOME`).
- [x] References / relations strategy — `manually_linked_items` rebuilt
      from `relations.json`; predecessor/successor UIDs travel in the
      extra state; other relation fields renamed at import.
- [x] Per-content-type migration scripts — `PMImportContent` hooks
      (field renames, DataGrid row keys, extra state),
      `@@import_pm_tool_settings`, `@@import_pm_manually_linked_items`,
      `@@import_pm_post_process` (user folders faceted setup +
      `categorized_elements`).
- [ ] End-to-end dry run against a real 4.3 export (needs a prod copy).

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
