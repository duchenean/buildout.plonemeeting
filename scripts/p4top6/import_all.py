# Run the D.6 import steps on the Plone 6.1 site, in the order of
# MIGRATION_DATA.md section 2.
#
#   bin/instance-import run scripts/p4top6/import_all.py [step ...]
#
# With no argument every step runs. The JSON files come from the export
# directory (COLLECTIVE_EXPORTIMPORT_CENTRAL_DIRECTORY). The script runs
# as a Manager and commits after each step.
import logging
import os
import sys
import time

import transaction
from AccessControl.SecurityManagement import newSecurityManager
from plone.browserlayer.utils import registered_layers
from zope.component.hooks import setSite
from zope.globalrequest import setRequest
from zope.interface import alsoProvides
from zope.interface.interfaces import IInterface

SITE_ID = os.environ.get("PM_IMPORT_SITE_ID", "Plone")
ADMIN = "admin"


def script_args(argv):
    """zopectl runs a script as [interpreter, "-c", <script>, <args>]."""
    if len(argv) > 2 and argv[1] == "-c":
        return argv[3:]
    return argv[1:]


def export_directory():
    from App.config import getConfiguration
    from collective.exportimport import config

    return config.CENTRAL_DIRECTORY or getConfiguration().clienthome


class Runner(object):

    def __init__(self, portal, request, directory):
        self.portal = portal
        self.request = request
        self.directory = directory

    def path(self, name):
        return os.path.join(self.directory, name)

    def view(self, name):
        return self.portal.restrictedTraverse("@@%s" % name)

    def reset_form(self, **kwargs):
        self.request.form.clear()
        self.request.form["form.submitted"] = True
        self.request.form.update(kwargs)

    def content(self, filename, handle_existing="0"):
        """Import one content JSON file.

           handle_existing: 0 skips content that is already there, 2
           updates it."""
        self.reset_form(commit="500", handle_existing_content=handle_existing)
        with open(self.path(filename), "rb") as jsonfile:
            return self.view("import_content")(jsonfile=jsonfile)

    def other(self, view_name, filename):
        """Import one JSON file of the non-content exporters."""
        self.reset_form()
        with open(self.path(filename)) as jsonfile:
            return self.view(view_name)(jsonfile=jsonfile.read())

    def with_path(self, view_name, filename):
        """Call one of the @@import_pm_* views."""
        self.reset_form(path=self.path(filename))
        return self.view(view_name)()

    def plain(self, view_name, **kwargs):
        self.reset_form(**kwargs)
        return self.view(view_name)()

    def update_local_roles(self):
        """Recompute the advices index and the local roles of every item
           and meeting. It does not touch the catalog."""
        tool = self.portal.portal_plonemeeting
        warnings = tool.update_all_local_roles(redirect=False)
        return "%s warnings" % len(warnings)

    def rebuild_catalog(self):
        """The last word on what the site holds."""
        catalog = self.portal.portal_catalog
        catalog.clearFindAndRebuild()
        return "%s brains" % len(catalog)


def setup_logging():
    """Show what the import does.

       zopectl leaves the root logger alone, so the INFO lines of the
       import hooks (directory fields, registry records, deferred
       fields) would go nowhere and only the warnings would reach
       stderr. Only these two loggers are raised: the root logger at
       INFO buries them under the startup of every egg."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(name)s: %(message)s"))
    for name in ("plonemeeting.core: p4top6 import",
                 "collective.exportimport.import_content",
                 "collective.exportimport.import_other"):
        log = logging.getLogger(name)
        log.setLevel(logging.INFO)
        log.addHandler(handler)


def steps(runner):
    """name -> what to run, in order."""
    return (
        ("members", lambda: runner.other("import_members", "members.json")),
        ("tool", lambda: runner.with_path("import_pm_tool_settings", "tool.json")),
        # Keep handle_existing at "0". On a deserialization error
        # collective.exportimport calls manage_delObjects on the id of
        # the item, and in update mode that is content that was already
        # there. See MIGRATION_DATA.md, "Update mode deletes content".
        ("contacts", lambda: runner.content("contacts.json")),
        # after the contacts: the selected organizations are organization
        # UIDs, and writing them creates the Plone group of every
        # organization. Before the configs: the fields of a MeetingConfig
        # that point at an organization use that same list.
        ("registry", lambda: runner.with_path(
            "import_pm_registry", "registry.json")),
        ("configs", lambda: runner.content("configs.json")),
        # second pass over the same file: a POD template that reuses
        # another one, an annex type that points at the type a scan
        # becomes, a category that points at the category of another
        # config... all point at an object of the same file that comes
        # later. The pass skips what is already there and only retries
        # what failed.
        ("configs2", lambda: runner.content("configs.json")),
        # folders before the content they hold: the items of a user live
        # in Members/<user>/mymeetings/<cfg_id>
        ("folders", lambda: runner.content("folders.json")),
        # the meeting folder of a user is a plain folder in the export:
        # the meeting_config property, the dashboard and the permissions
        # are not in the JSON. The property says which MeetingConfig an
        # item belongs to, so it must be there before the items are.
        ("meeting_folders", lambda: runner.plain("import_pm_meeting_folders")),
        ("content", lambda: runner.content("content.json")),
        # the images of an item live in the item: they are in
        # folders.json, which runs before the items exist
        ("folders2", lambda: runner.content("folders.json")),
        # last pass over the fields that pointed at content which did not
        # exist yet when their own object was imported
        ("deferred", lambda: runner.plain("import_pm_deferred_fields")),
        ("linked_items", lambda: runner.with_path(
            "import_pm_manually_linked_items", "relations.json")),
        ("localroles", lambda: runner.other("import_localroles", "localroles.json")),
        ("ordering", lambda: runner.other("import_ordering", "ordering.json")),
        ("defaultpages", lambda: runner.other(
            "import_defaultpages", "defaultpages.json")),
        ("redirects", lambda: runner.other("import_redirects", "redirects.json")),
        ("post_process", lambda: runner.plain("import_pm_post_process")),
        ("fix_html", lambda: runner.plain("fix_html")),
        ("reset_dates", lambda: runner.plain("reset_dates")),
        # the advices index and the local roles of every item and
        # meeting, now that the configs, the advices and the imported
        # local roles are all there
        ("local_roles", lambda: runner.update_local_roles()),
        # the step above and the review states do not touch the catalog
        ("catalog", lambda: runner.rebuild_catalog()),
    )


def main(root, wanted):
    setup_logging()
    newSecurityManager(None, root.acl_users.getUser(ADMIN).__of__(root.acl_users))
    portal = getattr(root, SITE_ID)
    setSite(portal)
    request = root.REQUEST
    setRequest(request)
    for layer in registered_layers():
        if IInterface.providedBy(layer):
            alsoProvides(request, layer)

    runner = Runner(portal, request, export_directory())
    all_steps = steps(runner)
    names = [name for name, run in all_steps]
    unknown = [name for name in wanted if name not in names]
    if unknown:
        print("Unknown step(s): %s" % ", ".join(unknown))
        print("Known steps: %s" % ", ".join(names))
        return

    for name, run in all_steps:
        if wanted and name not in wanted:
            continue
        print("\n=== %s ===" % name)
        start = time.time()
        try:
            result = run()
        except Exception as exc:
            transaction.abort()
            print("FAILED after %.1fs: %s: %s" % (time.time() - start,
                                                  type(exc).__name__, exc))
            raise
        transaction.commit()
        if result and not isinstance(result, str):
            result = repr(result)[:300]
        print("%s done in %.1fs: %s" % (name, time.time() - start,
                                        (result or "")[:300]))

    print("\ncatalog: %s brains" % len(portal.portal_catalog))
    print("configs: %r" % (list(portal.portal_plonemeeting.objectIds()), ))


main(app, script_args(sys.argv))  # noqa: F821
