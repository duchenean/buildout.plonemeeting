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

## How to use this file

When starting Stage D, grep the codebase for the marker comment to
locate every dropped feature in one pass:

    grep -rn "P6 migration:" src/ *.cfg

Each match points to a block of commented code that can be uncommented
once the corresponding provider packages are bumped to P6/Py3 releases.
