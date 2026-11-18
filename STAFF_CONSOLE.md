# HarkynB staff portal

Create a second Cloudflare Worker named **harkynb-admin** in the account that hosts **harkynb-production**. Connect the same GitHub repository and main branch using root directory `admin`, blank build command and deploy command `npx wrangler deploy`. Alternatively run `npx wrangler deploy --config admin/wrangler.jsonc` from the repository root in an authenticated terminal.

The admin Worker serves the login page at / and registration at /signup. It uses its own SQLite Durable Object for accounts and sessions. A service binding retrieves the website assets and an external Durable Object binding accesses the existing published pages, photos and private enquiries. The public Worker must already exist.

## First manager

Register your own username and password on the new Worker. The pending screen displays your account ID. Set the **plain text** variable OWNER_ACCOUNT_ID on the admin Worker to that exact ID and deploy. Alternatively set vars.OWNER_ACCOUNT_ID in admin/wrangler.jsonc in the repository and deploy. This ID is an identifier and does not grant sign-in. Keep the setting across deployments.

Once approved, open Staff access. Verify the account ID with each staff member before selecting their role. Editor can publish, inbox can review enquiries, manager can do both and approve colleagues. Select pending to remove console access. Staff choose their own passwords. Sessions expire after eight hours or on logout. This release has no self-service forgotten-password flow.

## Deployment and route map

Both Workers build from the same repository and branch, `main`. With root directory `/` and build command `npm run build`, use these deploy commands.

| Worker | Deploy command | Serves |
| --- | --- | --- |
| harkynb-production | `npx wrangler deploy --config wrangler.jsonc` | Public pages, enquiry submission, published photos and the Studio database |
| harkynb-admin | `npx wrangler deploy --config admin/wrangler.jsonc` | Staff pages, account and session storage, and authenticated publishing and inbox actions |

| Entry or action | Destination |
| --- | --- |
| Public navigation and contact forms | Public Worker. Forms post to `/api/enquiries` across all five teams. |
| Public staff bookmarks | `/admin/` redirects to the admin console. Old invitation pages lead to admin signup. Staff API writes must go directly to the admin Worker. |
| Staff signup, login, logout | Admin Worker at `/signup`, `/login`, `/logout`. New staff await approval. |
| Staff access | Admin `/team`. The designated owner and managers approve roles. |
| Page text, photos and restore | Admin `/admin/page`. The generated `/editor-pages.json` lists editable pages and fields. Editors and managers publish to the public Worker's Studio object. |
| Form inbox and status changes | Admin `/admin/enquiries`. Inbox staff and managers can read submissions and change their status. |
| Published photo URLs | Public `/media/{id}`. The admin Worker retrieves previews through its SITE binding. |

Verify deployments independently. A successful public build does not deploy admin code. If an admin build stops at Cloning, retry that build and check the GitHub repository connection if fetching repeatedly fails.
