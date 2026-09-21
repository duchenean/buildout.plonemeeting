# Create the empty Plone 6.1 site the D.6 import runs into.
#
# The order follows PMLayer.setUpPloneSite: the PloneMeeting profile needs
# plone.app.contenttypes, a default workflow chain and a Members folder.
# The script must run as a Manager: some setup handlers do workflow
# transitions that are guarded by a role.
# See MIGRATION_DATA.md section 2.
import transaction
from AccessControl.SecurityManagement import newSecurityManager
from plone.base.utils import unrestricted_construct_instance
from Products.CMFPlone.factory import addPloneSite

SITE_ID = "Plone"
PROFILE = "plonemeeting.communes:default"
ADMIN = "admin"

root = app  # noqa: F821
if root.acl_users.getUser(ADMIN) is None:
    # "bin/instance run" does not create the initial user of the recipe
    root.acl_users._doAddUser(ADMIN, ADMIN, ["Manager"], [])
    transaction.commit()
    print("Created the Zope root user %s" % ADMIN)
newSecurityManager(None, root.acl_users.getUser(ADMIN).__of__(root.acl_users))

if SITE_ID in root.objectIds():
    print("The site %s already exists" % SITE_ID)
else:
    site = addPloneSite(
        root,
        SITE_ID,
        title="iA.Delib - P4 to P6 dry run",
        profile_id="Products.CMFPlone:plone",
        extension_ids=("plone.app.contenttypes:default", ),
        default_language="fr",
        portal_timezone="Europe/Brussels",
    )
    transaction.commit()
    print("Created %s" % site.absolute_url_path())

    site.portal_workflow.setDefaultChain("simple_publication_workflow")
    if not hasattr(site.aq_base, "Members"):
        unrestricted_construct_instance("Folder", site, "Members")
    transaction.commit()

    site.portal_setup.runAllImportStepsFromProfile("profile-%s" % PROFILE)
    transaction.commit()
    print("Installed %s" % PROFILE)
    print("configs: %r" % (list(site.portal_plonemeeting.objectIds()), ))
    print("catalog: %s brains" % len(site.portal_catalog))
    print("types: %s" % len(site.portal_types.objectIds()))
