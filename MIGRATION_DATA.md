# D.6 — Data migration runbook (Plone 4.3 → Plone 6.1)

Path chosen in [`PLONE6_MIGRATION_PLAN.md`](PLONE6_MIGRATION_PLAN.md) §5.5:
`collective.exportimport` JSON export from the 4.3 site, import into a
fresh 6.1 site. No in-place ZODB upgrade.

Import-side code lives in
`plonemeeting.core/src/plonemeeting/core/migrations/p4top6/`
(active only when `collective.exportimport` is installed —
ZCML condition). Field mappings: `mappings.py`; hooks:
`import_content.py`; invariant tests: `tests/testP4ToP6Migration.py`.

## 1. Export side (a Plone 4.3 / Python 2.7 buildout)

The export runtime must still have the **full 4.2 stack**: every class
stored in the production ZODB has to be importable. The slimmed master
of this buildout (no SOAP, no AMQP, no async, no cron4plone) is not
suitable. Use a throwaway clone at the last commit before the Stage A
slimming, and keep the production database copy read-only:

```sh
git clone <buildout.pm> pm42_export && cd pm42_export
git checkout -b export-p43 <last full-stack commit>
cp <prod copy>/filestorage/<site>.fs var/filestorage/   # work on a copy
virtualenv -p python2 . && bin/python bin/pip install -r requirements.txt
bin/python bin/buildout -c export-p43.cfg
```

`export-p43.cfg` extends the production profile cfg and adds one part:

```ini
[buildout]
extends = communes.cfg
parts = instance-export
# the export egg pulls unpinned dependencies
allow-picked-versions = true

[instance-export]
recipe = plone.recipe.zope2instance
zeo-client = false
file-storage = ${buildout:directory}/var/filestorage/<site>.fs
blob-storage = <prod copy>/blobstorage-<site>
zcml-additional =
# imio.zamqp.pm builds its consumer utility at ZCML load time and reads
# this product-config. The values are dummies, nothing connects.
zope-conf-additional =
  <product-config imio.zamqp.core>
      client_id       019999
      routing_key     019999
      ws_url          http://localhost:6543
      ws_login        testuser
      ws_password     test
  </product-config>
environment-vars =
    COLLECTIVE_EXPORTIMPORT_CENTRAL_DIRECTORY ${buildout:directory}/var/export
eggs =
    ${instance1:eggs}
    collective.exportimport
zcml =
    ${instance1:zcml}

[versions]
collective.exportimport = 1.16
# collective.exportimport 1.16 needs pyrsistent < 0.16
pyrsistent = 0.15.7
```

Notes on that part:

- `zcml = ${instance1:zcml}` matters. A shorter list changes the load
  order of the `Products.PloneMeeting` overrides and the startup then
  fails on ZCML conflicts.
- `plone.restapi` 7.8.2 is enough. The runbook asked for 7.9.1 for the
  versions export, and versions are dropped, so leave `plone.rest` at
  the version the 4.2 stack pins.
- No GenericSetup install is needed: the export views register on the
  site root.


### Export sequence (as admin)

1. **Content** — run the export script, not the `@@export_content` form.
   The stock export only carries schema fields, workflow history and a
   few extras; PloneMeeting keeps a lot of state in plain persistent
   attributes and annotations (see "Extra state" below). Copy
   `plonemeeting.core/src/plonemeeting/core/migrations/p4top6/export_p43.py`
   **and** `extra_state.py` (same directory) to the 4.3 server, then:

   ```sh
   # every portal type that has content
   PM_EXPORT_SITE_ID=demo/demo bin/instance-export run $(pwd)/export_p43.py
   # or an explicit list of types
   PM_EXPORT_SITE_ID=demo/demo bin/instance-export run $(pwd)/export_p43.py \
       MeetingConfig MeetingItemCollege MeetingCollege
   ```

   Give the script an **absolute path**: zopectl runs it as
   `[interpreter, "-c", <script>, <args>]`, so a relative name does not
   resolve against the current directory.

   Env knobs: `PM_EXPORT_SITE_ID` (default `Plone`, a path such as
   `demo/demo` when the site is in a mounted database),
   `PM_EXPORT_TARGET_SITE_ID` (the id of the Plone 6 site, see
   "The id of the new site" below), `PM_EXPORT_FILENAME` (default
   `pm_content.json`, written to `var/instance/` or to
   `COLLECTIVE_EXPORTIMPORT_CENTRAL_DIRECTORY`). The script uses
   `include_blobs=2` (blob paths, JSON stays small; the import resolves
   them against the old blobstorage) and `migration=False` (the
   "modify for migrations" option drops relation fields; our import hooks
   do the renames). It aborts the transaction at the end.

   **Unexported paths** go to `<filename>.errors.json`, not into the
   content file: `write_errors=True` appends them to the JSON array as
   an `{"unexported_paths": [...]}` entry, and the import reads the
   `@id` of every entry.

   **URLs.** Every URL of the exported site is rewritten to
   `http://nohost/<target site id>`, whatever host wrote it. A
   serializer that resolves its object outside the acquisition chain of
   the request — a relation field, for example — writes another host
   than the one of the exported item, and the plone.restapi relation
   deserializer only resolves a URL that starts with the portal URL of
   the site it imports into. The import normalizes the host a second
   time, so an export made on a server with a public host name imports
   as well.

   **Export the types in this order**, one file each, so the import can
   follow the same order (see section 2):

   | file | portal types |
   |---|---|
   | `contacts.json` | `directory organization person held_position` |
   | `configs.json` | `MeetingConfig meetingcategory ContentCategoryConfiguration ContentCategoryGroup ContentCategory ContentSubcategory ItemAnnexContentCategory ItemAnnexContentSubcategory DashboardCollection DashboardPODTemplate ConfigurablePODTemplate StyleTemplate` |
   | `folders.json` | `Folder Document Image File Link Event Collection Message` |
   | `content.json` | every `Meeting*` / `MeetingItem*` type of every config, `meetingadvice`, `annex`, `annexDecision` |

   `Topic` (Plone 4 collections) has no Plone 6 type: convert the ones
   that matter to `Collection` on the 4.3 side before the export, or
   leave them behind.

   **Extra state.** For every exported object the script adds a
   `pm_extra_state` key: `{"attributes": {...}, "annotations": {...}}`,
   JSON-encoded by `extra_state.py` with the container and date types
   tagged so they are restored exactly (PersistentMapping/PersistentList,
   OrderedDict, tuple, set, DateTime, datetime, date; py2 utf-8 `str`
   becomes text). What is carried:
   - items (`MeetingItem*`): `adviceIndex`, `takenOverByInfos`,
     `itemHistory`, `autoCopyGroups`, `autoRestrictedCopyGroups`,
     `emergency_changes_history`, `completeness_changes_history`,
     `linked_predecessor_uid`, `linked_successor_uids`;
   - meetings (`Meeting*`): `item_absents`, `item_excused`,
     `item_non_attendees`, `item_signatories`, `item_attendees_positions`,
     `item_attendees_order`, `item_votes`, `ordered_contacts`,
     `_number_of_items`;
   - advices (`meetingadvice*`): `advice_row_id`, `advice_given_history`,
     `advice_hide_during_redaction_history`;
   - annotations: `ftw.labels:labeling` and the
     `PloneMeeting-sent_to_other_meetingconfig_*` markers.

   Caches are deliberately not exported and are rebuilt on the 6.1 side:
   `_labels_access_cache`, `_insert_order_cache`, `categorized_elements`
   (collective.iconifiedcategory). A value of an unsupported type is
   replaced by `null` and logged as a warning at export time: check the
   export log on the dry run.
2. **Everything that is not content** — copy `export_other_p43.py` to
   the 4.3 server next to the other two and run it:

   ```sh
   PM_EXPORT_SITE_ID=demo/demo bin/instance-export run $(pwd)/export_other_p43.py
   ```

   With no argument it writes `tool.json`, `registry.json`,
   `relations.json`, `members.json`, `localroles.json`, `ordering.json`,
   `defaultpages.json`, `redirects.json` and `portlets.json`. Name one
   or more exports to run only those. It aborts the transaction at the
   end.

   - `registry.json` holds the `plone.registry` records of
     `REGISTRY_RECORDS`: the selected organizations, the function
     suffixes and the managed groups of
     `collective.contact.plonegroup`. They are records, not content, and
     collective.exportimport has no registry exporter. Without them the
     new site has no selected organization, so no Plone group and an
     empty vocabulary for every field that points at an organization.
     Extend the list for a profile package that keeps more settings in
     the registry.

   - `relations.json` holds the `ManuallyLinkedItem` rows that step 7 of
     the import needs, plus the contact `position` and `voting_group`
     rows. The contact ones also travel as relation fields in the
     content, so the content import restores them.
   - `tool.json` holds the 12 `portal_plonemeeting` fields, under their
     Dexterity names. `portal_plonemeeting` is a tool, not content, so
     `collective.exportimport` cannot export it. The script warns about
     an accessor the 4.3 tool does not have, and logs the row keys of
     the `holidays`, `config_groups` and `advisers_config` grids: check
     them against the Dexterity `DictRow` keys.
   - Portlets: review the result. Most PM dashboards are faceted, not
     portlets.

Copy to the new server: the JSON files **and** `var/blobstorage`
(read-only is fine).

## 2. Import side (this buildout, Plone 6.1)

`collective.exportimport = 1.16` is pinned and in the dev/test eggs.
Set `COLLECTIVE_EXPORTIMPORT_BLOB_HOME=/path/to/old/blobstorage` in the
instance environment.

`import-p6.cfg` builds an `instance-import` part with its own
filestorage and blobstorage, so a dry run does not touch the
development site and can start again from an empty database:

```sh
bin/python bin/buildout -c import-p6.cfg install instance-import
rm -rf var/filestorage/import.fs* var/blobstorage-import   # start over
bin/instance-import run scripts/p4top6/create_site.py
bin/instance-import run scripts/p4top6/import_all.py [step ...]
```

`create_site.py` makes the empty site, `import_all.py` runs the steps
below in order and commits after each one. Both run as a Manager:
several setup handlers and import steps do workflow transitions that a
role guards, and the Zope system user does not pass them.

**The id of the new site must be the id the export was written for.**
`collective.exportimport` builds the target path from the `@id` of an
item: it drops the first element and resolves the rest against the new
site. Pass `PM_EXPORT_TARGET_SITE_ID` on the 4.3 side (section 1).

**Update mode deletes content.** With `handle_existing_content=2`
(Update), a deserialization error makes `collective.exportimport` call
`manage_delObjects` on the item id, which is content that was already
there. Keep the "Skip" option, and give a field that fails validation a
deferred import instead.

**A MeetingConfig needs its workflow fields at creation.**
`collective.exportimport` creates an empty object and deserializes it
afterwards. PloneMeeting builds the portal types and duplicates the
workflows of a config on `ObjectAddedEvent`
(`tool.invokeFactory('MeetingConfig', **data)` is its supported path),
and the vocabulary of several config fields reads the states of the
item workflow. An empty config therefore registers the *base* portal
type names, gets no workflow, and the deserializer raises `IndexError`
in `getItemWorkflow()`. `mappings.CONFIG_FACTORY_FIELDS` travels in the
`factory_kwargs` of the item so the values are set before the object
reaches its container; the rest follows through the deserializer and
the `ObjectModifiedEvent` of `finish()`.

The **workflow adaptations** cannot travel that way:
`_performWorkflowAdaptations()` walks the `searches` folders of the
config, and `onConfigInitialized()` creates them *after* it calls
`registerPortalTypes()`. They are applied on the created object
instead, right before it is deserialized, because many fields of a
config point at item states that only exist once they are applied
(`accepted_but_modified`, `returned_to_proposing_group`, …).

**A MeetingConfig also stores MeetingItem field names as values.**
`used_item_attributes`, `historized_item_attributes`, the column lists
and `item_fields_config.name` hold AT camelCase names, and the Plone 6
vocabularies list the Dexterity ones. The same `MEETINGITEM_AT_TO_DX`
table renames those values (`mappings.MEETINGCONFIG_ITEM_FIELD_NAME_*`),
including the `MeetingItem.<name>` form of `xhtml_transform_fields`.

**Some MeetingConfig fields skip the deserializer**
(`mappings.MEETINGCONFIG_RAW_GRIDS` and `MEETINGCONFIG_RAW_FIELDS`, set
with `setattr` in `global_obj_hook`). A `DataGridField` row is validated
by `DictRow` with the *row* as context, so every `Choice` column whose
vocabulary reads the MeetingConfig — its item states, its labels, its
item fields, the other configs — comes back empty and refuses every
value. `used_poll_types` builds its own vocabulary from its stored
value, and the Plone 6 item-attributes vocabulary no longer offers
`title` for `historized_item_attributes`. A row is stored as a plain
dict of plain values, which is what the export carries, and PloneMeeting
builds a config the same way
(`tool.invokeFactory('MeetingConfig', **data)`). Add a grid to the tuple
if a pilot site reports it as "Constraint not satisfied" or "Wrong
contained type" — unless one of its columns is a Date or a file, which
does need the deserializer.

**UIDs the profile creates again.** `onConfigInitialized()` recreates
the `searches` folders and every `DashboardCollection` of a config, so
the import skips them as existing content and they keep the UID of the
*new* site. `PMImportContent` notes every such pair in a UID map on the
portal (`plonemeeting.core.p4top6.uid_map`) and the deferred pass
rewrites the UIDs of a value before applying it, so
`to_do_list_searches` and the like point at the right object.

**Two passes over the same file.** A POD template that reuses another
one, an annex type that names the type a scan becomes, a category that
points at the category of another config: all point at an object that
comes *later* in the same file, and the invariant of a POD template
wants a file or a template to reuse, so a deferred field would not save
it. `import_all.py` runs `configs.json` twice (`configs`, `configs2`)
and `folders.json` twice (`folders`, `folders2`, the second time after
the items, because the images of an item live in the item). A pass
skips what is already there and only retries what failed.

**A term is stored as its token.** `plonemeeting.restapi` overrides the
deserializer and stores a value before it checks the vocabulary — an
Archetypes validator ran after the mutator, and the PloneMeeting
vocabularies include the stored value. The `{"token": …, "title": …}`
dict of the export would stay in the field and the next vocabulary that
reads it fails (`'dict' object has no attribute 'split'`), so every
`Choice` value is reduced to its token first, against the real schema.
The `language` of a 4.3 object is the empty token, which Plone 6 does
not offer: the key is dropped and the site language applies
(`mappings.DROP_EMPTY_CHOICE_FIELDS`). A `null` on a field Plone 6
requires is dropped the same way, so the Dexterity default stands.

**Blobs before the deserializer.** `collective.exportimport` writes a
`blob_path` field after deserializing. An invariant that wants a file
then fails on an object that has none yet — a POD template wants an
`odt_file` or a template to reuse — and the whole object is lost.
`PMImportContent` writes the blobs in
`global_obj_hook_before_deserializing` and takes the key out of the
data, so the invariant reads the object.

**No container is ever invented.** The stock import creates the folder
structure a path needs. Here a missing container means the export is
incomplete or a step ran out of order, and the invented `Folder` would
sit where the real object belongs, so `PMImportContent.create_container`
only reports it. Grep the log for `No container for`.

**Deferred fields.** The references are circular: an organization
carries the advice settings of a MeetingConfig (`item_advice_states`,
`item_advice_edit_states`, `item_advice_view_states`) while a
MeetingConfig carries organization UIDs; an organization points at
other organizations (`groups_in_charge`) and at a held_position
(`certified_signatures`); a person points at an organization
(`primary_organization`); a held_position points at an organization
(`position`, `voting_group`, `represented_organizations`) and the
export is sorted by path, so a person that sorts before
`plonegroup-organization` holds a position in an organization that is
not imported yet. No import order satisfies all of that, and one field
that does not validate loses the whole object: the plone.restapi
deserializer raises on the first error and collective.exportimport
drops the item.

`mappings.DEFERRED_FIELDS` lists these fields per portal type.
`PMImportContent` takes them out of the item before deserializing and
keeps them on the portal, in the `plonemeeting.core.p4top6.deferred_fields`
annotation. Every import run retries the whole store when it ends, one
field at a time, so a value that still does not validate does not hold
back the others; `@@import_pm_deferred_fields` runs a last pass and
reports what is left:

```
deferred fields: 118 applied, 0 still waiting, 0 on objects that were
not imported
```

Anything other than `0 still waiting` needs a look: the field is in the
store, the object is imported, and the value does not validate against
the new site.

Fresh site prep, in order (`import_all.py` runs exactly these steps):

1. Create the Plone 6.1 site, install `plonemeeting.communes` profile
   (pulls plonemeeting.core; sets up tool, workflows, base config —
   **without** demo/example configs).
2. `@@import_members` (users + groups must exist before local roles /
   workflow history / configs).
3. `@@import_pm_tool_settings?path=…/tool.json`
4. Import **contacts** content (directory, organizations, persons,
   held_positions) — configs reference org UIDs. The `contacts`
   directory of the profile already exists, so the import skips it;
   `PMImportContent` applies its `position_types`,
   `organization_types` and `organization_levels` on the existing
   object instead, before the held_positions of the same file are
   deserialized against them.
5. `@@import_pm_registry?path=…/registry.json`. After the contacts,
   because the selected organizations are organization UIDs and writing
   them makes `collective.contact.plonegroup` create the Plone group of
   every organization. Before the configs, because every MeetingConfig
   field that points at an organization uses that same list.
6. Import **MeetingConfig** objects. Our `PMImportContent` renames the
   153 AT field names (incl. the 20 missing from the migration-summary
   doc and `budgetDefault`, which the doc wrongly lists as removed),
   remaps DataGrid row keys (`signatureNumber`, `insertingMethod`) and
   fires `ObjectModifiedEvent` in `finish()` so the derived Plone
   groups / cloned FTIs are (re)created.
7. Import the **folders** (`folders.json`), then the rest of the
   **content** (meetings, items, advices, annexes). Folders first: the
   items of a user live in `Members/<user>/mymeetings/<cfg_id>`. Items
   import with camelCase→snake_case renames applied;
   `manually_linked_items` is deliberately dropped here.
   `PMImportContent.global_obj_hook` restores the `pm_extra_state` of
   every object right after deserialization (before workflow history).
   Batch with `commit=500`; consider disabling `plone.versioning`
   during import (see c.e.i README) for speed.
7bis. `@@import_pm_deferred_fields` — last pass over the **deferred
   fields** (below).
8. `@@import_pm_manually_linked_items?path=…/relations.json`
   (rebuilds the UID lists from the `ManuallyLinkedItem` relation rows).
9. `@@import_localroles`, `@@import_ordering`, `@@import_defaultpages`,
   `@@import_redirects`.
10. `@@import_pm_post_process` — re-applies what the JSON cannot carry:
   every `Members/<user>/mymeetings/<cfg_id>` folder comes back as a plain
   Folder, so the view re-runs the PloneMeeting folder setup on it
   (faceted dashboard + `searches_*` sub-folders, `meeting_config`
   property, permissions, constrained types, MeetingManager local role;
   `tool.init_meeting_config_folder`) and rebuilds the
   collective.iconifiedcategory `categorized_elements` cache of every item
   and meeting (`?skip_categorized_elements=1` to skip that part). The
   config `searches` folders need nothing: they are recreated by
   `onConfigAdded` when the MeetingConfig is imported, and the 4.3 ones
   are skipped as existing content (keep the default "Skip" option for
   existing content).
11. `@@fix_html` (Plone 4 resolveuid/image markup → Plone 6).
12. `@@reset_dates` (restores original modification dates).
13. Rebuild catalog + PM-specific update: `portal_catalog` clear &
    rebuild, then `tool.update_all_local_roles()` (recomputes
    `adviceIndex` from configs and advices while keeping the imported
    delay data: `delay_started_on`, `delay_stopped_on`,
    `delay_changes_history`, `inherited`, `isConfidential`...) and
    `update_all_categorized_elements(item)` on every item and meeting
    (collective.iconifiedcategory) to rebuild the annex caches.

## 3. Verification checklist (per pilot site)

Count against the `portal_type` **index** of the 4.3 catalog, not the
catalog length: the demo copy holds 658 brains whose object is gone
(608 `annex`, 43 `annexDecision`, 4 `meetingadvice`, 2 `person`, 1
`Folder`) and a few brains with a trailing slash in their path. The
export walks the index, so those are not exported and must not be
counted as a loss. A `portal_catalog` clear & rebuild on the copy
before the export removes the difference.

- [ ] item/meeting/advice counts match the 4.3 catalog counts
- [ ] workflow history + review_state preserved on spot-checked items
- [ ] annex blobs open (blob paths resolved), previews regenerate
- [ ] `manually_linked_items` round-trip on a known linked pair
- [ ] MeetingConfig edit form loads and saves for every imported config
- [ ] derived Plone groups exist (advisers/observers/… suffixed groups)
- [ ] POD generation works on an imported item (LibreOffice)

## Open points

- ~~Advice data / annotations on items~~ — done: non-schema attributes and
  annotations travel in `pm_extra_state` (export script + import hook,
  tests in `testP4ToP6Migration.py`). The list of attributes lives in
  `extra_state.py`: extend it if a profile package stores more.
- `imio.history` histories go through the extra-state codec (py2 utf-8
  `str` → text); workflow-history comments are handled by
  collective.exportimport. Spot-check both on the dry run.
- ~~Faceted-navigation config on imported folders~~ — done:
  `@@import_pm_post_process` (step 8bis).
- ~~Versions (CMFEditions)~~ — **dropped**: nothing in plonemeeting.core
  or plonemeeting.communes creates versions any more (`version_object`
  has no caller; advice history uses imio.history). Export without
  `include_revisions`; `@@export_content` versions are not needed, so the
  plone.restapi ≥ 7.7.0 constraint on the 4.3 side only matters for the
  serializers themselves.
- End-to-end dry run against a real 4.3 export. **Export half done**
  (2026-09-22) on a copy of the `delib42` demo production instance:
  13847 catalog objects, 7 MeetingConfigs (college, council,
  bourgmestre, bp, cas, cppt, codir), 1.3 GB of blobs. The export
  runtime is the throwaway buildout described in section 1. A first
  pass over the configuration content plus the whole `bourgmestre`
  config (775 objects, 19 types) exports with **no error**: every entry
  has `parent`, all 775 carry `pm_extra_state`, 472 carry a workflow
  history.
  **Import half started.** The empty 6.1 site builds, `members` (232
  groups, 63 users) and `tool` (12 fields) import clean. The contacts
  do not yet:
  - the `contacts` directory of the 6.1 profile is skipped as existing
    content, so it keeps the one `default` position type and every
    `held_position` fails the `position_type` constraint. The directory
    fields of the 4.3 site need their own import step.
  - `groups_in_charge` (33 organizations), `primary_organization` (2
    persons) and `item_advice_states` (3 organizations) are forward
    references: an organization carries the advice settings of a
    MeetingConfig and a MeetingConfig carries organization UIDs, so no
    import order satisfies both. These fields need a deferred import,
    in `PMImportContent.finish()`. Update mode is not an option, see
    "Update mode deletes content".
  - `imio.esign` is not in the P6 stack. Its browser layer comes back
    as a broken class and is skipped, so whatever the esign serializers
    would add is not exported. Decide whether the pilot sites need it.
  - `config_groups` and `advisers_config` are empty on the demo, so
    their `DictRow` row keys are still unverified. `holidays` rows use
    the key `date`.
