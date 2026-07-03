# D.6 — Data migration runbook (Plone 4.3 → Plone 6.1)

Path chosen in [`PLONE6_MIGRATION_PLAN.md`](PLONE6_MIGRATION_PLAN.md) §5.5:
`collective.exportimport` JSON export from the 4.3 site, import into a
fresh 6.1 site. No in-place ZODB upgrade.

Import-side code lives in
`plonemeeting.core/src/plonemeeting/core/migrations/p4top6/`
(active only when `collective.exportimport` is installed —
ZCML condition). Field mappings: `mappings.py`; hooks:
`import_content.py`; invariant tests: `tests/testP4ToP6Migration.py`.

## 1. Export side (old 4.3 buildout, Python 2.7)

Add to the 4.3 buildout (`versions.cfg`):

```ini
collective.exportimport = 1.16   # last line still supports Plone 4.3 / py2 export
plone.restapi = 7.9.1            # last py2 line; >= 7.7.0 needed for AT versions export
plone.rest = 3.0.0
PyJWT = 1.7.1
```

Add `collective.exportimport` to instance eggs, run buildout, restart.
No GenericSetup install needed (views register on the site root).

### Export sequence (as admin, on `/Plone/@@export_content`)

1. **Content** — select all PloneMeeting portal types (MeetingConfig,
   every per-config `MeetingItemXxx` / `MeetingXxx` /
   `MeetingItemTemplateXxx` / `MeetingItemRecurringXxx` FTI,
   `meetingadvice`, annex types, contacts types, Folder, DashboardCollection,
   POD template types…). Options:
   - blobs: **"Include blob paths"** (`include_blobs=2`) — JSON stays small;
     the import resolves paths against the old blobstorage.
   - Do **not** tick "Modify exported data for migrations" for PM types
     blindly — it drops all relation fields; our hooks do the renames.
   - "Save to file on server" (or per-item files for very large sites,
     `download_to_server=2`).
2. `@@export_relations` (contains the `ManuallyLinkedItem` rows we need)
3. `@@export_members`, `@@export_localroles`, `@@export_ordering`,
   `@@export_defaultpages`, `@@export_redirects`, `@@export_portlets`
   (portlets: review — most PM dashboards are faceted, not portlets)
4. **Tool settings** — `portal_plonemeeting` is not exportable content
   (OFS tool). Dump it from a debug prompt (`bin/instance debug`) on 4.3:

```python
import json
tool = app.Plone.portal_plonemeeting
# AT accessor -> DX snake_case attribute; the 12 IToolPloneMeeting
# fields kept after B.3 (verify each accessor exists on the 4.3 tool —
# a couple were renamed/introduced during B.3, adapt if AttributeError)
FIELDS = {
    'getMeetingFolderTitle': 'meeting_folder_title',
    'getFunctionalAdminEmail': 'functional_admin_email',
    'getFunctionalAdminName': 'functional_admin_name',
    'getRestrictUsers': 'restrict_users',
    'getUnrestrictedUsers': 'unrestricted_users',
    'getWorkingDays': 'working_days',
    'getHolidays': 'holidays',
    'getDelayUnavailableEndDays': 'delay_unavailable_end_days',
    'getConfigGroups': 'config_groups',
    'getDeferParentReindex': 'defer_parent_reindex',
    'getShowExternalLinksSection': 'show_external_links_section',
    'getAdvisersConfig': 'advisers_config',
}
data = {dx: getattr(tool, at)() for at, dx in FIELDS.items()}
json.dump(data, open('/tmp/tool.json', 'w'))
```

   The 3 DictRow grids (`holidays`, `config_groups`, `advisers_config`)
   already use snake_case row keys in DX — check the 4.3 stored row
   dicts and rename keys in the dump if they differ.

Copy to the new server: the JSON files **and** `var/blobstorage`
(read-only is fine).

## 2. Import side (this buildout, Plone 6.1)

`collective.exportimport = 1.16` is pinned and in the dev/test eggs.
Set `COLLECTIVE_EXPORTIMPORT_BLOB_HOME=/path/to/old/blobstorage` in the
instance environment.

Fresh site prep, in order:

1. Create the Plone 6.1 site, install `plonemeeting.communes` profile
   (pulls plonemeeting.core; sets up tool, workflows, base config —
   **without** demo/example configs).
2. `@@import_members` (users + groups must exist before local roles /
   workflow history / configs).
3. `@@import_pm_tool_settings?path=…/tool.json`
4. Import **contacts** content (directory, organizations, persons,
   held_positions) — configs reference org UIDs.
5. Import **MeetingConfig** objects. Our `PMImportContent` renames the
   153 AT field names (incl. the 20 missing from the migration-summary
   doc and `budgetDefault`, which the doc wrongly lists as removed),
   remaps DataGrid row keys (`signatureNumber`, `insertingMethod`) and
   fires `ObjectModifiedEvent` in `finish()` so the derived Plone
   groups / cloned FTIs are (re)created.
6. Import the rest of the content (meetings, items, advices, annexes,
   POD templates, folders). Items import with camelCase→snake_case
   renames applied; `manually_linked_items` is deliberately dropped here.
   Batch with `commit=500`; consider disabling `plone.versioning`
   during import (see c.e.i README) for speed.
7. `@@import_pm_manually_linked_items?path=…/relations.json`
   (rebuilds the UID lists from the `ManuallyLinkedItem` relation rows).
8. `@@import_localroles`, `@@import_ordering`, `@@import_defaultpages`,
   `@@import_redirects`.
9. `@@fix_html` (Plone 4 resolveuid/image markup → Plone 6).
10. `@@reset_dates` (restores original modification dates).
11. Rebuild catalog + PM-specific update: `portal_catalog` clear &
    rebuild, then the usual `@@update-local-roles` equivalent /
    `tool.update_all_local_roles()` sanity pass.

## 3. Verification checklist (per pilot site)

- [ ] item/meeting/advice counts match the 4.3 catalog counts
- [ ] workflow history + review_state preserved on spot-checked items
- [ ] annex blobs open (blob paths resolved), previews regenerate
- [ ] `manually_linked_items` round-trip on a known linked pair
- [ ] MeetingConfig edit form loads and saves for every imported config
- [ ] derived Plone groups exist (advisers/observers/… suffixed groups)
- [ ] POD generation works on an imported item (LibreOffice)

## Open points

- Advice **annotations** on items (`ANNOTATION_KEY` advice data): verify
  they are carried by the item serializer (annotations are not exported
  by default) — may need a dedicated export/import hook pass.
- `imio.history` / workflow-history comments encoding spot-check
  (py2 str → py3 str).
- Faceted-navigation config on imported folders (re-apply
  `faceted_conf/` XML rather than importing the annotations).
- Versions (CMFEditions) — decide keep-or-drop; export needs
  plone.restapi ≥ 7.7.0 if kept.
