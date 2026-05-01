# Plone 4.3 → Plone 6 / Python 3 — Migration Plan

> **Scope.** This is the *minimal* path to a working Plone 6 build of iA.Delib.
> Goal: keep the application functionally equivalent, with the lightest possible
> dependency footprint. UI/UX overhauls and redesigns are explicitly **out of scope**.
>
> **Renames.** As part of the migration:
> - `Products.PloneMeeting` → **`plonemeeting.core`** (Python distribution name)
> - `plonemeeting.communes` → **`plonemeeting.communes`**
>
> **Forks used for the migration buildout.** All migration work happens against the iMio
> forks already wired in `sources.cfg`:
> - `git@github.com:duchenean/plonemeeting.core.git` — repo holding the migrated
>   `plonemeeting.core` package (note the repo-vs-package asymmetry: the **repo** is
>   `plonemeeting.core`, the **distribution name** inside it is `plonemeeting.core`)
> - `git@github.com:duchenean/plonemeeting.communes.git` — repo + package both
>   `plonemeeting.communes`
>
> The canonical `IMIO/Products.PloneMeeting` and `IMIO/plonemeeting.communes` repos remain
> the source of truth for the Plone 4.3 line and receive only hotfixes during the migration.
>
> **Source-of-truth references**
> - AT→DX progress for `MeetingConfig`: branch `origin/feature/meetingconfig-at-to-dx`
>   in `src/Products.PloneMeeting/` (which already tracks `duchenean/plonemeeting.core`),
>   file `MIGRATION_SUMMARY.md` on that branch.
> - This document tracks the *Plone-version* migration (P4→P6) at the buildout level.

---

## 0. Strategy at a glance

A clean four-stage strategy, each stage shippable on its own:

| Stage | What ships | Still on |
|---|---|---|
| **A — Slim down** | Unused/obsolete addons removed; SOAP/AMQP dropped; AT-only widgets ported | Plone 4.3 / Py 2.7 |
| **B — Finish AT→DX** | `MeetingConfig` (already on branch) + `MeetingItem` migrated; `ToolPloneMeeting` cleansed | Plone 4.3 / Py 2.7 |
| **C — Modernize & rename (code-side only)** | Py3-ready code (static checks), buildout → pip/uv, package rename, `zodbupdate` rename rules in place | Plone 4.3 / Py 2.7 (still runnable) |
| **D — Plone 6.1 Classic cutover** | Dependency bumps, runtime validation on Py 3.12, data migration, production rollout | Plone 6.1 Classic / Py 3.12 |

**No Plone 5.2 bridge.** Plone 5.2 is deprecated; the extra hop is not worth maintaining.
The trade-off is real: Py3 compatibility work in Stage C cannot be executed end-to-end
until Stage D, so Stage C relies on **static analysis** (lint, AST scanners, type-stub
checks) rather than a green test matrix. The mitigation is to do Stage D as a single
focused cutover sprint with a sanitized prod copy as the validation harness.

The **Stage A→B order** is deliberate: dropping AT-only addons first reduces the surface
that the DX migrations have to keep alive. Stage C is the *only* irreversible step before
runtime cutover (package rename); everything in A and B is mergeable to `master` in small PRs.

---

## 1. Inventory: keep / drop / rewrite

### 1.1 Drop without replacement (Stage A)

These are easy wins — features already disabled, deprecated, or covered elsewhere.

| Package | Reason | Action |
|---|---|---|
| `collective.zamqp`, `imio.zamqp.pm`, `imio.zamqp.core`, `imio.dataexchange.core` | AMQP integration; Py2-only; rarely active | Disable `instance-amqp` part, drop eggs, drop `amqp.cfg` |
| `imio.pm.ws` (SOAP) + `ZSI`, `SOAPpy`, `suds-jurko`, `wstools`, `fpconst` | SOAP webservice — superseded by `plonemeeting.restapi` (already at 2.13) | Confirm WSClient consumers migrated to REST, then drop |
| `plone.app.async`, `zc.async`, `zc.twist`, `zc.dict`, `zc.queue`, `Twisted 15.x` | `zc.async` doesn't run under Plone 6 / Py3 modern stack; few jobs use it | Drop `instance-async` part; reroute the 1–2 cron jobs to plain Plone clock-server |
| `Products.cron4plone` | Replaceable with built-in Zope clock-server or systemd timers | Drop; reimplement scheduled tasks via clock-server endpoints |
| `archetypes.schematuning` | AT-only optimization layer | Drop with AT |
| `archetypes.referencebrowserwidget` | AT-only widget | Drop with AT |
| `Products.DataGridField` | AT-only | Replace with `collective.z3cform.datagridfield` (already used by some addons) |
| `Products.DocFinderTab`, `Products.DCWorkflowGraph`, `iw.debug`, `collective.profiler` | Dev/debug helpers | Drop or move to dev-only |
| `collective.usernamelogger` | Trivial logger | Replace with simple PAS plugin or drop |
| `Products.PrintingMailHost` | Local-only debug mail | Keep dev-only |
| `collective.captcha`, `skimpyGimpy` (via `communesplone.layout`) | Unused on iA.Delib? | Verify, drop |
| `communesplone.layout` | **Abandoned, no Py3 release** | Identify which features are actually used; port the handful that matter directly into `plonemeeting.core` |
| `collective.documentviewer`, `repoze.catalog` | Document preview backend; unclear current usage | Audit; drop if unused |
| `Products.PasswordStrength` | Plone 6 ships its own password policy | Drop, configure native policy |
| `imio.webspellchecker` | WebSpellChecker integration; verify still needed | Drop if unused |
| `collective.ckeditor` + transitive deps (`collective.quickupload`, `collective.plonefinder`, `demjson`, `ua-parser`) | Plone 6 ships **TinyMCE** out of the box | Drop the whole stack and delete `src/Products/PloneMeeting/ckeditor/` (plugins, JS, ZCML registrations) outright — no audit, no parity port. Configure the built-in TinyMCE with stock settings |

### 1.2 Replace with modern equivalent (Stage A or C)

| Old | New | Notes |
|---|---|---|
| `collective.ckeditor` (CKEditor 4) | **TinyMCE** (Plone 6 default) | Major content-editing change; document for end users; CKEditor 4 is EOL anyway |
| `Products.DataGridField` (AT) | `collective.z3cform.datagridfield` | Done as part of Stage B (DX migration of MeetingItem/MeetingConfig) |
| `archetypes.referencebrowserwidget` | `plone.app.relationfield` + `plone.app.contenttypes` widgets | Same |
| `collective.compoundcriterion` (❌ no Py3 release) | Inline equivalent inside `plonemeeting.core` (small package, ~few hundred LOC) | Vendor or rewrite |
| `imio.dashboard` (❌ Py2-only, tightly coupled to old eeafaceted) | Either: port to P6 ourselves, or fold into `plonemeeting.core` | Hard call — see §3 |

### 1.3 Migrate / bump (Stage C)

These are load-bearing and *must* exist on Plone 6. Most are iMio- or collective-maintained
and are either ready or "almost ready" — verify each `setup.py` and create an issue per package.

| Package | Action |
|---|---|
| `eea.facetednavigation` | Bump to ≥ 16.4 (Plone 6 ready since 2024) |
| `collective.eeafaceted.{collectionwidget,dashboard,z3ctable,batchactions}` | Verify P6 branches; iMio-controlled, port if needed |
| `collective.contact.{core,plonegroup,widget}` | Verify P6 status; port if needed (we own these forks) |
| `collective.documentgenerator` | Bump to **4.0** — already known-working on Plone 6.1 / Py 3.x |
| `collective.iconifiedcategory`, `collective.dms.scanbehavior` | Verify P6 branch; port if needed |
| `collective.behavior.{internalnumber,talcondition}` | Verify P6 branch |
| `collective.querynextprev`, `collective.messagesviewlet`, `collective.excelexport` | Same |
| `ftw.labels` | Verify P6 branch (4teamwork-maintained) |
| `appy` (iMio fork, POD) | **Already known-working** on Plone 6.1 / Py 3.x — bump to current iMio release |
| `dexterity.localroles`, `dexterity.localrolesfield` | Bump to 2.0+ (P6 prerelease as of Jan 2026) |
| `plone.app.versioningbehavior`, `plone.formwidget.namedfile` | Bump to 2.0.5 / 3.1.2 (P6-ready) |
| `plone.formwidget.masterselect` | Verify, port if needed |
| `plone.restapi` | Already on 7.x; bump to 9.x for Plone 6 |
| `plonemeeting.restapi`, `imio.restapi` | Bump in lockstep with plone.restapi 9.x |
| `imio.{actionspanel,annex,helpers,history,prettylink,migrator,fpaudit,pyutils,pm.locales}` | Audit each `setup.py`; most have Py3 work in flight |
| `plonetheme.imioapps` | Already has Py3 wheel; verify P6 classifiers in latest release |
| `Products.CMFPlacefulWorkflow` | Bump to 3.0.6 (P6-ready) — *but consider dropping*: Plone 6 stores workflow placement in core for many cases |

### 1.4 Killer packages

`Products.PloneMeeting` itself is renamed and ported (§4–5). `plonemeeting.communes`
(and the other profile packages — Charleroi, Liege, PROVHainaut, BEP, Mons, Namur, Seraing,
Lalouviere, CPASLalouviere) follow the same renaming pattern. Only **MeetingCommunes** is in
the explicit minimal scope — others are tracked but not blocking.

---

## 2. Stage A — Slim down

Goal: reduce the package count, run the full test suite green, ship small PRs to `master`
that already cleanly remove dead code paths. Still on Plone 4.3 / Py 2.7.

**Tasks**

1. **Drop AMQP**
   - Remove `imio.zamqp.pm`, `collective.zamqp` from `setup.py` install_requires of `Products.PloneMeeting`
   - Delete `amqp.cfg`, `instance-amqp` part, `imio.dataexchange.core`
   - Audit `Products.PloneMeeting/src/Products/PloneMeeting/` for `zamqp` imports; delete or feature-flag
   - **Acceptance**: tests pass without AMQP; an existing prod instance running without `instance-amqp` is functionally equivalent

2. **Drop SOAP**
   - Confirm with downstream consumers (PloneMeeting WSClient users) that REST covers their needs
   - Remove `imio.pm.ws`, `ZSI`, `SOAPpy`, `wstools`, etc.
   - Migrate any internal callers to `plonemeeting.restapi`
   - **Acceptance**: `bin/test imio.pm.ws` no longer needed; integration tests of REST endpoints green

3. **Drop async**
   - List `zc.async` jobs (`grep -r "queueJob\|IAsyncService"`); reroute to clock-server
   - Remove `instance-async` and the async eggs
   - **Acceptance**: scheduled tasks still fire on the live system

4. **Drop debug-only / unused**
   - `Products.cron4plone`, `collective.usernamelogger`, `Products.PasswordStrength`,
     `imio.webspellchecker` (if not used), `collective.captcha` (if not used),
     `collective.documentviewer` (if not used)
   - **Acceptance**: full functional test suite green; manual smoke test of common flows

5. **Drop `communesplone.layout`**
   - Identify the (likely small) set of features still in use — viewlets, CSS, registrations
   - Inline the necessary parts into `plonemeeting.core` (Stage C) or into `plonetheme.imioapps`
   - **Acceptance**: visual diff acceptable; no missing CSS/JS in dashboards

6. **Tag a release**: `4.3.x` final cut with reduced footprint; this is what we'll dual-maintain
   for hotfixes during Stage B–D.

**PR style**: one addon dropped per PR, with the regression test plan in the description.

---

## 3. Stage B — Finish Archetypes → Dexterity

Goal: every content type is Dexterity. AT framework can be removed in Stage C.

**3.1 `MeetingConfig` (already in flight)**

Branch `origin/feature/meetingconfig-at-to-dx` in `Products.PloneMeeting`.
Rebase on the slimmed-down `master` from Stage A and merge. Treat
`MIGRATION_SUMMARY.md` (on that branch) as the punch list.

**3.2 `MeetingItem` (≈ 8.5 kLOC)**

This is the biggest piece of work. Approach (mirrors the MeetingConfig phasing
that already worked):

- **Phase 1** — Schema declaration: write `content/meetingitem.py` with a
  `model.Schema`-style declaration; mirror all AT field names (snake_case rename
  follows the same convention as MIGRATION_SUMMARY.md); register via ZCML and FTI XML.
- **Phase 2** — Bootstrap: keep AT class registered as legacy; ensure both can coexist
  in the test layer (the MC migration showed how to do this).
- **Phase 3** — Migrate accessor calls in core modules (`events.py`, `utils.py`, `adapters.py`,
  `vocabularies.py`, `indexes.py`).
- **Phase 4** — Migrate accessor calls in browser layer (`browser/views.py`, `browser/overrides.py`,
  templates).
- **Phase 5** — Migrate test suite.
- **Phase 6** — DataGridField fields: replace AT `Products.DataGridField` with
  `collective.z3cform.datagridfield`.
- **Phase 7** — Subtypes `MeetingItemTemplate`, `MeetingItemRecurring`: ensure they re-derive cleanly.

No in-place ZODB upgrade step is needed. Production data migration is `collective.exportimport`
(§5.5), so the path is: Plone 4.3 site exports AT `MeetingItem`s as JSON (with whatever serializer
suits the AT side); Plone 6.1 site imports them as DX `MeetingItem`s. The serializer/deserializer
pairing is part of the Stage D mechanics and is intentionally not designed in this plan.

**Acceptance**: full test suite green on Plone 4.3 with the new DX `MeetingItem`; manual smoke
test of item creation, advices, duplications, sent-to-other-MC, decisions on a freshly-built
test site (no upgrade-from-AT path required).

**3.3 `ToolPloneMeeting` (1.8 kLOC)**

Convert to a `plone.registry`-backed control panel **plus** a small Dexterity content type
for the parts of the tool that hold per-instance child content (the existing
`MeetingConfig`s, POD templates, contained folders). The Archetypes-derived OFS tool goes
away entirely.

- Move scalar configuration (booleans, strings, list-of-strings settings) onto a
  `plone.registry` schema; expose via a Plone control panel.
- Keep the *containment* behaviour by making the tool a Dexterity folder (so `MeetingConfig`s
  and other contained items continue to live "inside" the tool at the same path).
- Update every `getToolByName(self, 'portal_plonemeeting')` / `api.portal.get_tool('portal_plonemeeting')`
  call site to whatever accessor pattern we adopt — likely a small helper in
  `plonemeeting.core.utils` that hides the rebinding.

**Acceptance**: every reference to `portal_plonemeeting` in the codebase resolves through
the new accessor; control-panel form lets administrators edit the registry-backed settings;
contained `MeetingConfig`s remain reachable at their existing path.

**3.4 Delete AT framework**

Once the above three are done, search for `Products.Archetypes` imports across `src/`.
There should be **none**. Remove `archetypes.schematuning` and `archetypes.referencebrowserwidget`
from `versions.cfg` and `install_requires`.

---

## 4. Stage C — Modernize and rename (code-side, still on Plone 4.3 / Py 2.7)

Goal: every line of code is **ready** for Python 3.12 / Plone 6.1, and the package rename has
landed, but the runtime is still Plone 4.3 / Py 2.7. Stage C never executes the code on Py3 —
the test suite stays green on Py 2.7 / Plone 4.3 throughout. Py3 issues are caught by static
analysis; runtime validation happens in Stage D.

This is the longest stage, but it is the cheapest place to make these changes: the existing
test suite is fast, predictable, and known-green, and we are not also fighting framework
upgrades.

**4.1 Python 3 readiness (static-only)**

Tooling, applied to `plonemeeting.core` (post-rename) and to all in-repo iMio packages:

- Run `pyupgrade --py27-plus` then `pyupgrade --py3-plus` (the latter as a *check* — surfaces
  remaining Py2-only constructs).
- Run `python -m pylint --py3k` and resolve every warning. This is the canonical static
  Py3-readiness check.
- Run `flake8 --select=B,C,E,W,F` plus `flake8-modern` if installed.
- Add `from __future__ import absolute_import, division, print_function, unicode_literals`
  to every `.py`.
- Manual audits of well-known Py3 traps:
  - `dict.has_key()`, `iteritems`/`itervalues`/`iterkeys`, `xrange`, `unicode`, `basestring`
  - `print` statements, `except E, e` → `except E as e`
  - octal literals (`0755` → `0o755`), tuple-unpack in lambdas, relative imports
  - bytes/str discipline — `safe_unicode` / `safe_encode` from `imio.pyutils` are already
    widely used; finish the job. Every file touched should be unambiguous about whether it
    operates on `bytes` or `str`.
  - `__cmp__` → `__eq__` / `__lt__` / `functools.total_ordering`
  - dict ordering assumptions (Py 3.7+ preserves insertion order, but Plone 4.3 + Py 2.7
    callers may have relied on undefined order)
- `six` is already pinned (1.16.0). Use it as the bridge during Stage C; remove every `six.`
  call in Stage D once Py2 is gone.
- **Acceptance**: `pylint --py3k` reports no errors on the entire `src/` tree;
  the existing Py 2.7 / Plone 4.3 test suite is still green.

**4.2 Buildout → pip / uv**

- Replace `Makefile` + `buildout.cfg` chain with a `pyproject.toml` + `requirements/*.txt`
  + `cookiecutter-plone` style layout.
- Keep the *profile selection* abstraction (currently switching `.cfg`s); reimplement as
  `make profile=communes run`.
- Use `mxdev` for development checkouts (the modern `mr.developer`).
- Keep the `Makefile` thin wrapper so muscle memory still works.

**4.3 Package rename**

The rename is mechanical but exhaustive. **Every** import and **the Python namespace itself**
must change — there is no partial-rename half-state that compiles. Treat this as one focused PR
per package, with the search/replace driven by a script that's checked into the repo so it can
be re-run on rebase.

- `Products.PloneMeeting` → **`plonemeeting.core`**:
  - **Filesystem move**: `src/Products/PloneMeeting/*` → `src/plonemeeting/core/*`. Delete
    `src/Products/__init__.py` (the namespace marker) and the now-empty `Products/` directory.
    Create `src/plonemeeting/__init__.py` and `src/plonemeeting/core/__init__.py`.
  - **Namespace declaration**:
    - `setup.py`: `name='plonemeeting.core'`, drop `namespace_packages=['Products']`,
      add `namespace_packages=['plonemeeting']`, update `package_dir`, regenerate
      `find_packages('src')`.
    - `MANIFEST.in`: rewrite every `recursive-include Products/PloneMeeting …` to
      `recursive-include plonemeeting/core …`.
    - The new `plonemeeting/__init__.py` declares the namespace
      (`__import__('pkg_resources').declare_namespace(__name__)` for setuptools-style, or PEP 420
      implicit if dropping setuptools nspkg). Match the convention used by `imio.*` packages
      so all iMio namespaces line up.
  - **Every Python import** must change. This includes:
    - `from Products.PloneMeeting...` → `from plonemeeting.core...` (every module, every
      submodule path)
    - `import Products.PloneMeeting...` → `import plonemeeting.core...`
    - `Products.PloneMeeting.config.PROJECTNAME` and the `PROJECTNAME` constant value
      (currently `"PloneMeeting"`) — review whether downstream callers depend on the *string*
      and update accordingly
    - Imports inside test modules (`tests/`) and inside every `migrations/migrate_to_*.py`
      (yes, including historical ones — the runtime imports them; "freezing" them as historical
      breaks the upgrade chain)
    - Type annotations / docstring references / log messages that mention
      `Products.PloneMeeting` for grepability
  - **ZCML**: `<configure xmlns:...>` files in `profiles/`, `browser/`, `behaviors/`,
    `content/`, `workflows/`, top-level `configure.zcml`. Change `<include package="Products.PloneMeeting"/>`,
    `for="Products.PloneMeeting...IFoo"`, `factory="Products.PloneMeeting...Foo"`,
    `class="Products.PloneMeeting...Foo"`, `permission="Products.PloneMeeting..."` (custom
    permissions) — every dotted path.
  - **GenericSetup XML**:
    - `profiles/default/metadata.xml`: profile id renames from `Products.PloneMeeting:default`
      to `plonemeeting.core:default`. Add the old id as an alias for one release so
      existing sites can still find the profile during upgrade.
    - `profiles/default/types/*.xml`: every `<property name="factory">` and `<property name="klass">`
      that references the old dotted path.
    - `profiles/default/workflows/*/*.xml`: any script paths or guard expressions using the
      old import path.
    - `profiles/default/import_steps.xml`, `export_steps.xml`: handler imports.
    - Faceted XML configs in `faceted_conf/` — class references in custom widgets.
  - **Translation domain**: keep the translation domain name `PloneMeeting` if `imio.pm.locales`
    keys off it (renaming the domain forces a re-translation pass). Verify in the `.po` headers
    of `imio.pm.locales`. Likewise `i18n_domain` attributes in templates and ZCML.
  - **Page templates** (`browser/templates/*.pt`, `skins/*/`): `metal:use-macro` and
    `tal:define` paths that reference `Products.PloneMeeting/...` via traversal, and any
    `python:` expression that imports from the package.
  - **Compatibility shim** (optional, dev-convenience only): because production data
    migration uses `collective.exportimport` (§5.5), the new code never opens an old
    pickled ZODB; a Products.PloneMeeting → plonemeeting.core pickle-loading shim is
    therefore not required for the migration itself. A throwaway shim may still be useful
    for developers who want to point a local Plone 4.3 instance at a renamed checkout —
    keep it scoped to dev tooling.
  - **Buildout / dependency declarations**: `versions.cfg`, `versions-dev.cfg`,
    `requirements.txt`, `auto-checkout` lists in `dev.cfg`. In `sources.cfg` the `[sources]`
    line keying off `Products.PloneMeeting` becomes `plonemeeting.core` and points at the
    iMio fork `git@github.com:duchenean/plonemeeting.core.git` (repo name stays
    `plonemeeting.core`; only the `[sources]` key and the installed distribution name
    change to `plonemeeting.core`). Likewise the `plonemeeting.communes` source line
    becomes `plonemeeting.communes` pointing at `duchenean/plonemeeting.communes.git`.
    Update the profile `.cfg` files (`communes.cfg`, `communes-dev.cfg`, etc.) accordingly.
  - **CI**: `Jenkinsfile`, GitHub Actions workflows, `bin/test -s Products.PloneMeeting` →
    `bin/test -s plonemeeting.core`, the `[test]` and `[testrestapi]` parts in `dev.cfg`.
  - **Repo-level**: `setup.cfg` (flake8/isort scopes), `.coveragerc` source paths, `tox.ini` if
    present, `Makefile` targets that reference `src/Products.PloneMeeting/`.

- `plonemeeting.communes` → **`plonemeeting.communes`**: same recipe end-to-end, smaller
  surface. Done in lockstep with the `Products.PloneMeeting` rename so there is never a state
  where one half compiles against `Products.PloneMeeting` and the other against
  `plonemeeting.core`.

- The other profile packages (Charleroi, Liege, PROVHainaut, BEP, Mons, Namur, Seraing,
  Lalouviere, CPASLalouviere) follow the identical recipe, but are out of *minimal* scope.

**Pickle/ZODB note**: persistent classes pickled in the ZODB carry their dotted name. With
`collective.exportimport` as the chosen migration path (§5.5), this concern is sidestepped —
the new Plone 6.1 site is built fresh and content is re-imported via JSON, never deserialized
from an old pickle. The rename PR can therefore land without ZODB-compat plumbing as long as
existing Plone 4.3 sites continue running the unrenamed package until cutover.

**4.4 Pre-cutover freeze**

- Make sure `pylint --py3k` has zero errors on every package in `src/`.
- Tag a pre-cutover release of `plonemeeting.core` and `plonemeeting.communes` so Stage D
  can be reproducibly built from a known commit.
- Snapshot a sanitized prod ZODB + blobs (`make copy-data`) — this is the validation
  harness for Stage D.

**Acceptance**: Plone 4.3 / Py 2.7 test suite still green after rename + pyupgrade;
`pylint --py3k` clean; sanitized prod copy archived and tagged.

---

## 5. Stage D — Plone 6.1 Classic / Py 3.12 cutover

The single runtime jump. No intermediate Plone version. Everything written in Stage C
finally executes on Py 3.12 here. Expect this stage to surface bugs that no static analysis
caught — that is the cost of skipping a 5.2 bridge, and the structure below assumes it.

**5.1 Stand up a Plone 6.1 Classic skeleton**

- New `requirements/` pinned to **Plone 6.1.x** + Python **3.12**.
- Use `cookiecutter-plone` (or equivalent) as the layout reference; keep `plonemeeting.core`
  and `plonemeeting.communes` as src checkouts via `mxdev`.
- Plone 6.1 **Classic** theme. The Plone 6 Classic UI is the only frontend we ship.
- Bring up an empty Plone 6.1 site with our two packages installed and the test profile
  applied. This is the first time the codebase actually runs on Py 3.12.

**5.2 Dependency bumps to Plone 6.1 lines**

- `plone.restapi` → 9.x (Plone 6.1 line)
- `eea.facetednavigation` → 16.x: faceted XML/JSON config files in `faceted_conf/` likely need
  small adjustments — track in a sub-task.
- `dexterity.localroles`, `dexterity.localrolesfield` → 2.x
- `plone.app.versioningbehavior` → 2.x; `plone.formwidget.namedfile` → 3.x
- `collective.documentgenerator` → 4.0 + `appy` POD (current iMio release) — both already
  known-working on Plone 6.1 / Py 3.x; straight pin bump, no porting work expected
- `collective.contact.{core,plonegroup,widget}`, `collective.eeafaceted.*`,
  `collective.iconifiedcategory`, `collective.dms.scanbehavior`,
  `collective.behavior.{internalnumber,talcondition}`, `collective.querynextprev`,
  `collective.messagesviewlet`, `collective.excelexport`, `ftw.labels` — bump to their
  P6 release lines. Where a P6 release does not yet exist, port the package (these are
  mostly iMio-controlled or co-maintained).
- `imio.{actionspanel,annex,helpers,history,prettylink,migrator,fpaudit,pyutils,pm.locales,
  restapi,webspellchecker}` → P6 lines.
- `plonetheme.imioapps`: ensure a P6.1-compatible release exists. If not, ship initially with
  stock Plone 6 Classic theme and port iMio styling as a follow-up (out of *minimal* scope).
- TinyMCE: stock built-in, no plugin parity work (Stage A dropped CKEditor outright).

**5.3 `imio.dashboard` decision**

By this point one of two outcomes:

- (a) a P6 fork of `imio.dashboard` exists and is usable → bump pin and move on.
- (b) inline the remaining `imio.dashboard` features directly into `plonemeeting.core`.

This is a sizable sub-task either way and is the single biggest schedule risk inside Stage D.

**5.4 Iterate until tests pass**

- Get the `plonemeeting.core` test suite green on Plone 6.1 / Py 3.12. This is where
  static-analysis-driven Py3 prep meets reality. Expect non-trivial fix-up:
  - lxml/BeautifulSoup string-vs-bytes drift
  - `DateTime` vs `datetime` boundaries
  - Catalog query result type changes
  - `IRequest` / browser-layer registration changes between P4 and P6
  - Workflow chain registration differences (especially if `Products.CMFPlacefulWorkflow`
    was dropped vs. bumped — see §1.3)
- Get the `plonemeeting.communes` test suite green.
- Get `plonemeeting.restapi` integration tests green.

**5.5 Data migration — direction (mechanics deferred)**

The long-term path is **`collective.exportimport`**: dump content from the Plone 4.3
instance to JSON, fresh-install Plone 6.1, import into the new site. This is the planned
direction; the concrete upgrade-step mechanics — which exporters to enable, how to handle
each content type, the workflow-history strategy, blob handling, references and relations —
are intentionally **out of scope for this plan** and will be designed when Stage D begins,
working against the sanitized prod copy archived at the end of Stage C.

We are deliberately *not* using an in-place ZODB upgrade. The package rename, the AT→DX
work, the namespace move, and the Py2→Py3 pickle conversion together make in-place too
fragile to plan around; export/import sidesteps those compounding risks.

**5.6 Production rollout**

- Pilot on one profile (Communes) before rolling Charleroi/Liege/etc.
- Maintain Plone 4.3 hotfix branch in parallel during a defined parallel-run period.
- Rollback plan: the ZODB from before cutover is the rollback (the in-place upgrade is
  destructive on the upgraded copy; keep the source ZODB untouched).

**Acceptance**: at least one customer running the new stack in production; zero P0
regressions during a soak period; the 4.3 branch is officially in maintenance-only mode.

---

## 6. Workstreams & ownership

Recommended split (assuming the existing iMio team):

| Workstream | Stage | Owner notes |
|---|---|---|
| Drop AMQP/SOAP/async | A | Clear scope; junior+senior pair |
| AT→DX MeetingItem | B | Senior with the most context on the existing branch's patterns |
| AT→DX ToolPloneMeeting | B | Same person, after MeetingItem is merged |
| Buildout → pip/uv | C | DevOps-leaning engineer |
| Package rename | C | One person, one focused PR; the rest is shim cleanup |
| imio.* dep audit & port | C–D | Distribute across team — one package per dev |
| Data migration spike | D | The person closest to ZODB / production restores |

---

## 7. Risks & open questions

1. **`imio.dashboard` is the single biggest unknown.** It's tightly coupled to old
   `collective.eeafaceted.*` releases that may not have been ported in lockstep.
   Spike-decide early in Stage C: port vs. inline vs. replace.
2. **`communesplone.layout`** is dead. The first Stage A spike should grep across all consumer
   sites for which features are actually live, before deciding how much to inline.
3. **REST consumer compatibility.** `plonemeeting.restapi` versions and downstream WSClient
   consumers must move in lockstep with `plone.restapi` 7.x → 9.x.
4. **Profile packages other than Communes** (Charleroi, Liege, PROVHainaut, BEP, Mons, Namur,
   Seraing, Lalouviere, CPASLalouviere) are out of minimal scope but each one will repeat the
   Stage C–D rename + bump cycle once the pattern is set.
5. **Workflow placement** — if we drop `Products.CMFPlacefulWorkflow` instead of bumping it,
   audit for `IPlacefulWorkflowConfiguration` markers in the codebase and customers' data.

---

## 8. Done definition

The migration is **done** when:

- [ ] One iMio customer runs `plonemeeting.core` + `plonemeeting.communes` on Plone 6.1 Classic / Py 3.12 in production
- [ ] CI matrix is green on Py 3.12 / Plone 6.1 only (the Py 2.7 / Plone 4.3 matrix is retired)
- [ ] No `Products.Archetypes` import remains in `src/`
- [ ] No package in `versions.cfg` requires Python 2
- [ ] `Products.PloneMeeting` and `plonemeeting.communes` repos are archived; the new repos are the source of truth
- [ ] A 4.3 hotfix branch exists, marked maintenance-only

---

## 9. Out of scope (explicit non-goals)

- New features or UX redesign
- Migration of profile packages other than `MeetingCommunes` to `plonemeeting.communes`
  (they follow once the pattern is set, but as separate efforts)
- Replacing `appy` POD generation with anything else
- Multi-tenant or any architectural change

---

*Initial draft.*
