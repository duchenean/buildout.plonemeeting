# buildout.pm

Buildout for `Products.PloneMeeting` and profile packages (`Products.MeetingCommunes`, `MeetingCharleroi`, `MeetingLiege`, `MeetingPROVHainaut`, `MeetingBEP`, `MeetingMons`, `MeetingNamur`, `MeetingSeraing`, `MeetingLalouviere`, `MeetingCPASLalouviere`).

- **Plone 4.3.20**, **Python 2.7**, ZEO + multi-instance (instance1, instance-async, instance-amqp).
- Source packages live in `src/` (managed by `mr.developer`, see `auto-checkout` in `dev.cfg`).
- Egg versions are pinned via `versions.cfg` (prod) and `versions-dev.cfg` (dev overlay).
- Repo sources are declared in `sources.cfg`.

## Profile selection

`buildout.cfg` is a switchboard: it extends exactly one profile `.cfg`. All profile lines except one are commented out. Default is `communes-dev.cfg`.

- `<profile>.cfg` → production-style buildout for that profile.
- `<profile>-dev.cfg` → dev overlay (extends `dev.cfg`, enables `auto-checkout`, debug, test runners).
- Optional add-ons: `amqp.cfg`, `solr.cfg`, `ldap.cfg`, `wca.cfg`, `prod-test.cfg`.

To switch profile: edit `buildout.cfg`, uncomment the desired line, leave the rest commented. Do **not** invent new profile names — they must match an existing `.cfg`.

## Config layering

```
buildout.cfg
  └─ <profile>-dev.cfg        # e.g. communes-dev.cfg
       └─ dev.cfg              # auto-checkout list, test parts, debug eggs
            └─ base.cfg        # zeoserver + instance1/async/amqp parts
                 ├─ versions.cfg / versions-dev.cfg
                 ├─ sources.cfg
                 └─ port.cfg   # ports, admin password, plone-path, SSO/Vision URLs
```

When changing instance config, prefer the lowest layer that still scopes correctly. `port.cfg` is the right place for port/password/URL knobs used across instances.

## Common commands

Run from the repo root via `make` (it wraps `bin/buildout`, `bin/zeoserver`, `bin/instance1`):

| Target | Action |
|---|---|
| `make buildout` | virtualenv + `bin/buildout` |
| `make buildout <other.cfg>` | run buildout against an alternate cfg |
| `make run` | buildout, restart zeo, start LibreOffice docker, run `instance1 fg` |
| `make test` | run the default test runner (`bin/testmc` for communes profile) |
| `make test <pattern>` | filter test names |
| `make libreoffice` / `make stop-libreoffice` | LibreOffice docker on port 2002 (needed for appy/PDF) |
| `make copy-data server=<host> buildout=<cfg>` | snapshot Data.fs + blobs from a prod server |
| `make cleanall` | nuke virtualenv + buildout artefacts |
| `make vc` | versioncheck report |

Defaults (from `port.cfg`): admin/admin, plone path `Plone`, instance1 on `:8081`, ZEO on `:8100`.

The test-runner part name depends on the active profile (`testmc` for communes, etc.). The `Makefile` hard-codes `testmc`; if you switch profile, override with `make test_suite=<part>`.

## Source layout (`src/`)

- `plonemeeting.core/` — core product (renamed from `Products.PloneMeeting`). Most schema/workflow/view code lives here.
- `Products.MeetingCommunes/` — profile-specific overrides and configurations for communes.
- `imio.*`, `collective.*`, `plone.restapi`, `plonemeeting.restapi`, `appy`, `ftw.labels` — auto-checked-out dependencies.

When bumping a release, update both `versions.cfg` and `versions-dev.cfg` so dev and prod stay aligned.

## Active migration

There is an in-progress **Plone 4 → Plone 6** migration. The core package has been renamed from `Products.PloneMeeting` to `plonemeeting.core`. See `MIGRATION_SUMMARY.md` at the repo root for the authoritative state (field renames, fieldsets, registration). When working on this, prefer the `plone-migrate-AT-to-DX` skill and treat `MIGRATION_SUMMARY.md` as the source of truth.

## Conventions

- Only one profile cfg active in `buildout.cfg` at a time — keep the others commented rather than deleting them.
- Don't run buildout without `make` (it manages the virtualenv and pip pins from `requirements.txt`).
- Don't add packages to `auto-checkout` unless they need local edits — pinned eggs are cheaper.
- Code-analysis is wired as a pre-commit hook via `dev.cfg [code-analysis]`; flake8 ignores are listed there.
