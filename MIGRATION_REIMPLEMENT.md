# Migration reimplementation tracker

Features dropped during **Stage A** of the Plone 4 → 6 migration that
need to be reimplemented in **Stage D** (Plone 6.1 / Py 3.12 cutover)
under the new stack. Each entry points to where the original code is
preserved as a comment, so reactivating it is a search-and-uncomment
exercise rather than a diff archaeology dig.

> Convention: when commenting code, mark it with the prefix
> `P6 migration: AMQP integration to be reimplemented in Stage D.`
> (or whichever feature the comment refers to). Grep for that string
> at any point to enumerate outstanding work.

---

## SOAP webservice (PR 1) — DROPPED OUTRIGHT, no reimplementation

`plonemeeting.restapi` already covers the SOAP surface (8/10 operations
mapped; the 2 gaps — `testConnectionRequest`, `getItemTemplateRequest` —
are external-only concerns). Source code, config, and dependencies were
deleted, not commented.

Affected packages: `imio.pm.ws`, `imio.pm.wsclient`, `ZSI`, `z3c.soap`,
`SOAPpy`, `suds-jurko`, `wstools`, `fpconst`.

---

## Async preview generation + cron4plone (PR 4) — REIMPLEMENT IN STAGE D

**Provider packages**

- `plone.app.async`, `zc.async`, `zc.twist`, `zc.dict`, `zc.queue`,
  `Twisted` 15.x, `zope.bforest`, `uuid` (zc.async stack)
- `Products.cron4plone` (cron-tab-style scheduler driven by an
  internal `<clock-server>` ticking `@@cron-tick`)

**What it did**

Two related concerns:

1. **Async preview generation.** `collective.documentviewer.async.queueJob`
   queued a `Converter(annex)()` invocation onto a `zc.async` queue,
   serviced by a dedicated `instance-async` worker. The patched
   `JobRunner.queue_it` in `imio.annex/patch.py` fired a
   `ConversionStartedEvent` so the UI could reflect "converting…".
2. **Scheduled tasks.** `Products.cron4plone` consulted a cron-tab
   (`@@cron-tick` view, hit hourly by a `<clock-server>` directive in
   `base.cfg`) and, at 01:45 daily, dispatched `@@pm-night-tasks`
   (which calls `@@update-delay-aware-advices` and
   `@@update-items-to-reindex`).

**Reimplement in Stage D**

- **Scheduled tasks** — we will *not* use `<clock-server>` in P6.
  Roll our own scheduler (system cron / Kubernetes CronJob / Celery
  beat / whatever fits the deployment). The view `@@pm-night-tasks`
  is preserved in `Products.PloneMeeting/browser/views.py` and
  remains callable; it just needs an external trigger.
- **Async preview generation** — conversion is currently inline
  (slower UX on annex upload). Stage D should reattach it to whatever
  background-task model we adopt. The `JobRunner` event hook in
  `imio.annex/patch.py` is preserved as a comment for reactivation.

**Commented call-sites in `Products.PloneMeeting`**

| File | What |
|---|---|
| `src/Products.PloneMeeting/setup.py` | `Products.cron4plone` install_requires |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/configure.zcml` | `<include package="Products.cron4plone" />` |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/profiles/default/metadata.xml` | `profile-Products.cron4plone:default` |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/setuphandlers.py` | `ICronConfiguration` import + cron-tab registration block |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/ToolPloneMeeting.py` | `queueJob` import; `convertAnnexes` now calls `Converter(annex)()` directly |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/events.py` | `queueJob` import; `_annexToPrintChanged` now calls `Converter(annex)()` directly |

**Commented call-sites in `imio.annex`**

| File | What |
|---|---|
| `src/imio.annex/src/imio/annex/patch.py` | `JobRunner` import, `jobrunner_queue_it` function (event-emitting wrapper around `JobRunner.queue_it`) |
| `src/imio.annex/src/imio/annex/configure.zcml` | `<monkey:patch>` for `JobRunner.queue_it` |

**Commented buildout pins**

- `versions.cfg`: `plone.app.async`, `zc.async`, `zc.twist`, `zc.dict`,
  `zc.queue`, `Twisted` 15.x, `zope.bforest`, `uuid` (transitive),
  `zc.ngi 2.0.1` (the 2.1.0 pin required by `zc.monitor` is kept),
  `Products.cron4plone`

**Commented runtime parts**

- `base.cfg`: `instance-async` part declaration, `plone.app.async` egg
  + ZCML in `instance1`, `<clock-server>` for `@@cron-tick`,
  `%include zope_add_async.conf`, `%include zeo_async.conf`
- `port.cfg`: `instance-async-http`, `instance-async-monitor`

**Dead helper left in place** (no callers)

- `Products.CPUtils/src/Products/CPUtils/Extensions/utils.py` —
  `clear_completed_async_jobs` uses lazy imports of `plone.app.async`
  / `zc.async`; nothing in the codebase calls it. Will be cleaned up
  in PR 6 / Stage D.

---

## CKEditor stack (PR 3) — REIMPLEMENT AS STOCK TINYMCE IN STAGE D

**Provider packages**

- `collective.ckeditor` (CKEditor 4 integration for Plone — EOL)
- `collective.plonefinder`, `demjson`, `ua-parser` (CKEditor-only
  transitive deps)

> Note: `collective.quickupload` is *kept* — `imio.annex` still uses it
> for its annex upload widget.

**What it did**

Rich-text editing for every meeting/item/advice text field. Custom
PMRichTextWidget added quick-edit / AjaxSave on top of the stock
CKEditor; PMCKFinder + PMAjaxSave wired CKEditor's file picker and
ajaxsave hooks into PM-specific save logic. A custom in-tree plugin
(`src/Products/PloneMeeting/ckeditor/imagerotate/`) added image
rotation buttons.

**Reimplement in Stage D**

Stock TinyMCE on Plone 6 — no parity port. The custom plugin
(image-rotate) is *not* coming back. The widget hooks (quick-edit,
ajax-save) need to be re-wired against TinyMCE if the UX is still
desired. The custom menu styles configured in `_configureCKeditor`
(highlight colors, font sizes, table layouts, page-break) translate
naturally to a TinyMCE `style_formats` config — use the commented
block as the source of truth for that mapping.

**Hard-deleted**

- `src/Products.PloneMeeting/src/Products/PloneMeeting/ckeditor/`
  (custom plugin subdirectory + `imagerotate/` plugin) — per the
  standing decision, no parity port.

**Commented call-sites in `Products.PloneMeeting`**

| File | What |
|---|---|
| `src/Products.PloneMeeting/setup.py` | `collective.ckeditor` install_requires |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/configure.zcml` | `<include package="collective.ckeditor" />`, `<include package=".ckeditor" />` |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/browser/configure.zcml` | `cke-save` overrides for `IMeetingContent` / `IMeetingAdvice`; `plone_ckfinder` browser:page |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/browser/overrides.py` | `CKFinder` / `AjaxSave` imports, `PMCKFinder`, `PMAjaxSave` classes |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/widgets/pm_richtext.py` | `Z3CFormWidgetSettings` import, `js_on_click` / `js_save` / `js_save_and_exit` / `js_cancel` bodies, `PMZ3CFormWidgetSettings` class |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/overrides.zcml` | `PMZ3CFormWidgetSettings` adapter |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/setuphandlers.py` | `configure_ckeditor` import, `_configureCKeditor` body, `_configureQuickupload` function, Scayt-removal block in `_installWebspellchecker`, call sites in `postInstall` |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/config.py` | `CKEDITOR_MENUSTYLES_CUSTOMIZED_MSG` constant |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/profiles/default/metadata.xml` | `profile-collective.ckeditor:default` dependency |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/profiles/default/jsregistry.xml` | `ckeditor_vars.js`, `ckeditor.js`, `ckeditor_plone.js` registrations (and `iframeresizer` insert-after rebased) |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/profiles/default/cssregistry.xml` | `imioapps_ckeditor_moonolisa.css` (and `batch_actions.css` insert-after rebased) |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/profiles/default/propertiestool.xml` | `ckeditor_properties` property sheet |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/tests/testViews.py` | `test_pm_RichTextWidget` |

**Migrations left untouched**

`migrations/migrate_to_4110.py`, `migrations/migrate_to_4200.py`,
`migrations/migrate_to_4201.py`, and `migrations/__init__.py` still
contain CKEditor-specific upgrade-step code (`addCKEditorStyle`,
Scayt removal, page-break style). These are historical: they target
profile versions ≤ 4201 and won't fire on a fresh install of profile
4217+. Leave them in place; they're inert unless a downstream
reinstalls from an old profile version. If that scenario actually
needs to be supported on a CKEditor-less codebase, guard each
`portal_properties.ckeditor_properties` access with `base_hasattr`.

**Commented buildout pins**

- `versions.cfg`: `collective.ckeditor`, `demjson`,
  `collective.plonefinder`, `ua-parser`
- `sources.cfg`: `collective.ckeditor`
- `dev.cfg`: already commented

---

## AMQP / scan_id integration (PR 2) — REIMPLEMENT IN STAGE D

**Provider packages**

- `imio.zamqp.pm` (PM-side: scan ID generation, barcode rendering,
  consumer for incoming scanned PDFs)
- `imio.zamqp.core` (shared utilities: `scan_id_barcode`, `next_scan_id`)
- `collective.zamqp` (AMQP/RabbitMQ wiring)
- `imio.dataexchange.core` (message envelope + persistence)

**What it does**

Scan-WS integration. External scanner microservices push scanned PDFs
back into Plone via AMQP. `iA.Delib` generates barcoded scan IDs inside
POD templates so finalised documents carry a machine-readable identifier
that the scanner microservice uses to re-attach the scanned copy as an
annex. Users can also manually insert a barcode into an existing PDF
annex via the "Insert barcode" action.

**Reimplement in Stage D**

- Verify provider packages have P6/Py3 releases. If not, port them
  (iMio-controlled).
- Re-add `imio.zamqp.pm` to `install_requires`, `<include>`, and
  `instance-amqp` runtime part.
- Uncomment the integration points listed below.

**Commented call-sites in `Products.PloneMeeting`**

| File | What |
|---|---|
| `src/Products.PloneMeeting/setup.py` | `imio.zamqp.pm` install_requires |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/config.py` | `HAS_ZAMQP` feature flag |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/setuphandlers.py` | `HAS_ZAMQP` import, `_configure_zamqp` function + call |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/configure.zcml` | `<include package="imio.zamqp.pm" />` |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/browser/views.py` | `scan_id_barcode` import; `get_scan_id` AMQP fallback branch; `print_scan_id_barcode` original body |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/testing.py` | `imio.zamqp.core` `product_config` dict in `PMLayer` |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/tests/testViews.py` | `DEFAULT_SCAN_ID` + `SEVERAL_SAME_BARCODE_ERROR` imports; `test_pm_Print_scan_id_barcode` |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/tests/testWFAdaptations.py` | `next_scan_id` + `DEFAULT_SCAN_ID` imports (replaced by inline stubs) |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/tests/testMeetingItem.py` | `DEFAULT_SCAN_ID` import (replaced by inline stub) |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/profiles/default/types/annex.xml` | "Insert barcode" action |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/profiles/default/types/annexDecision.xml` | "Insert barcode" action |

**Commented buildout pins**

- `versions.cfg`: `collective.zamqp`, `imio.zamqp.core`, `imio.zamqp.pm`,
  `imio.dataexchange.core`, `functools32` (transitive)
- `sources.cfg`: `imio.zamqp.core`, `imio.zamqp.pm` source lines
- `dev.cfg`: `imio.zamqp.pm` auto-checkout entry

**Commented runtime parts**

- `base.cfg`: `instance-amqp` part declaration; `${zope-conf:zamqp}`
  references on `instance1` and `instance-async`; `[zope-conf]`
  empty-default placeholders
- `port.cfg`: `instance-amqp-http`, `instance-amqp-monitor` ports
- `amqp.cfg`: kept on disk but no longer extended by `dev.cfg` or
  `prod.cfg`. Uncomment the `extends` line in those files when
  reactivating.
- `docker-dev.cfg`, `prod.cfg`: `[instance-amqp]` overrides commented

---

## communesplone.layout (PR 5) — REIMPLEMENT IN STAGE D *if needed*

**Provider package**

- `communesplone.layout` (iMio theme overlay — abandoned, no Py3
  release)

**What it did**

Provided ZCML-loaded translations, viewlets, and CSS overrides for
the "communes" municipal-portal look-and-feel. Plain ZCML inclusion;
zero direct Python imports inside the codebase.

**Reimplement in Stage D *if needed***

Audit found no in-tree Python references to `communesplone.layout`.
If a downstream visual regression appears after this drop (missing
viewlet, CSS, profile action), inline the specific feature into
either `plonemeeting.core` or `plonetheme.imioapps`. Otherwise,
drop the package permanently.

**Commented call-sites in `Products.PloneMeeting`**

| File | What |
|---|---|
| `src/Products.PloneMeeting/setup.py` | install_requires entry |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/configure.zcml` | `<include package="communesplone.layout" />` |
| `src/Products.PloneMeeting/src/Products/PloneMeeting/profiles/default/metadata.xml` | `profile-communesplone.layout:default` |

**Commented buildout pins**

- `versions.cfg`: `communesplone.layout`
- `sources.cfg`: `communesplone.layout` source line

> Note: `collective.captcha` and `skimpyGimpy` are listed in
> `versions.cfg` as transitive deps of `communesplone.layout`. They
> are handled in PR 6 (debug/unused leaves) along with the other
> dev-only inventory.

---

## How to use this file

When starting Stage D, grep the codebase for the marker comment to
locate every dropped feature in one pass:

    grep -rn "P6 migration:" src/ *.cfg

Each match points to a block of commented code that can be uncommented
once the corresponding provider packages are bumped to P6/Py3 releases.
