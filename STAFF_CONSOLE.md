# HarkynB staff portal

Create a second Cloudflare Worker named **harkynb-admin** in the account that hosts **harkynb-production**. Connect the same GitHub repository and main branch using root directory `admin`, blank build command and deploy command `npx wrangler deploy`. Alternatively run `npx wrangler deploy --config admin/wrangler.jsonc` from the repository root in an authenticated terminal.

The admin Worker serves the login page at / and registration at /signup. It uses its own SQLite Durable Object for accounts and sessions. A service binding retrieves the website assets and an external Durable Object binding accesses the existing published pages, photos and private enquiries. The public Worker must already exist.

## First manager

Register your own username and password on the new Worker. The pending screen displays your account ID. Set the **plain text** variable OWNER_ACCOUNT_ID on the admin Worker to that exact ID and deploy. Alternatively set vars.OWNER_ACCOUNT_ID in admin/wrangler.jsonc in the repository and deploy. This ID is an identifier and does not grant sign-in. Keep the setting across deployments.

Once approved, open Staff access. Verify the account ID with each staff member before selecting their role. Editor can publish, inbox can review enquiries, manager can do both and approve colleagues. Select pending to remove console access. Staff choose their own passwords. Sessions expire after eight hours or on logout. This release has no self-service forgotten-password flow.

The new portal does not use STAFF_INVITES. Existing passwords from the original console are separate. The public Worker retains its original routes during cutover. After verifying the new portal, disable the legacy STAFF_INVITES secret on the public Worker. Check a photo edit and restore, an enquiry and staff role restrictions on the deployed portal.
