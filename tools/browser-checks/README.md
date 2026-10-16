# Browser checks for the Plone 6 front-end (D.5bis)

Headless Chrome scripts (Playwright) that log in as `admin/admin`, load the
PloneMeeting dashboard, click the ported popups and upload a file through
the quick upload modal. They report console errors, failed requests, HTTP
errors and the state of the faceted widgets.

## Requirements

- A Playwright install. The scripts do not ship `node_modules`: point
  `NODE_PATH` at any project that has `playwright` installed, for example
  `NODE_PATH=~/Projects/tools.adeweb.dev/.ds-sync/node_modules`. Playwright
  falls back to the system Google Chrome (`channel: 'chrome'`) when its own
  Chromium build is missing.
- A running instance. Use `localhost`, never `127.0.0.1`: that host is on
  the diazo hostname blacklist, so the theme is off there.

## Private instance on port 8091

Do not restart the user's `bin/instance1`. Copy its config and run a second
ZEO client:

    SP=/tmp/inst8091; mkdir -p $SP/etc $SP/var $SP/log
    sed -e "s#^%define CLIENTHOME .*#%define CLIENTHOME $SP/var#" \
        -e "s#localhost:8081/Plone#localhost:8091/Plone#" \
        parts/instance1/etc/zope.conf > $SP/etc/zope.conf
    sed -e "s#0.0.0.0:8081#127.0.0.1:8091#" \
        -e "s#^zope_conf = .*#zope_conf = $SP/etc/zope.conf#" \
        -e "s#/var/log/#$SP/log/#g" \
        parts/instance1/etc/wsgi.ini > $SP/etc/wsgi.ini
    bin/python parts/instance1/bin/interpreter \
        ~/.buildout/eggs/cp312/Zope-5.14.2-py3.12.egg/Zope2/Startup/serve.py \
        $SP/etc/wsgi.ini -d debug-mode=on

Templates and static files reload without a restart in debug mode. Python
and registry (bundle) changes need a restart: CMFPlone caches the rendered
resource list per process.

## Scripts

    export NODE_PATH=<a node_modules with playwright>
    export BASE=http://localhost:8091/Plone   # default
    export OUT=/tmp/pw-shots                  # screenshots, default: this dir

- `dashboard_check.js`: login, first `mymeetings` dashboard, JS globals
  (`Faceted`, widgets, `qq`, `imio_modal`...), loaded scripts, problems.
- `popups_check.js`: item view, history modal, annexes page, quick upload
  and add annex modals, dashboard batch action modal. Opens and closes
  every modal, submits nothing.
- `upload_test.js`: uploads `qu_test.txt` through the quick upload modal
  and checks the annex is listed. Creates an annex on the item, delete it
  afterwards.
- `modal_debug.js`: dumps every `[class*="modal"]` element after a click.
- `err_locate.js`: finds the file and line of a `pageerror`.
- `layout_probe.js`: bounding boxes of the dashboard blocks, full-page
  screenshot.

The item and dashboard URLs are hard-coded for the dev site
(`plonemeeting-assembly`, `copy_of_recItem2`); adapt them in the scripts.
Plone 6.1 modals use `.modal-wrapper .modal.show`, not `.plone-modal`.
