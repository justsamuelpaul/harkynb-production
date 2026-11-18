# HarkynB staff console

Wrangler builds the public pages and applies the SQLite Durable Object migration. The Worker stores published photos, revisions and private enquiries in one named Durable Object.

## Invite staff

Deploy the Worker before sending invitations. The new Worker ignores STAFF_ACCOUNTS. Remove that old secret. If you previously used the literal example passwords on a live Worker, remove that secret immediately.

1. On your own computer in the repository, run `node scripts/staff-invite.mjs samuel manager`. Substitute a username and the role editor, inbox or manager. The command prints a private link and a JSON entry. Each invitation lasts 24 hours.
2. In Cloudflare open the harkynb-production Worker, Settings, Variables and Secrets. Save the generated JSON as a **Secret** named STAFF_INVITES and deploy the configuration. For more people merge entries into one JSON object. Keep the current roster in a password manager so you can retain existing entries when updating the secret.
3. Send each link privately to its named recipient. They open it, choose and confirm their own password, then sign in at /admin/. Each invitation works once. Only salted password hashes are stored.
4. Keep activated users in the roster. Invitation expiry only limits initial activation. To revoke access, remove the user's entry and deploy the updated secret. To reset a forgotten password, generate a fresh invite for the same username and replace that entry. The previous password immediately stops working once the updated secret is deployed.

Editor can publish, inbox can review enquiries, and manager can do both. Staff with old accounts need invitations. Use a private browser window on shared devices and close it when finished.

## Verify on the deployment

1. Choose a page and select a heading, paragraph or image. Change text or choose a JPEG, PNG or WebP and supply a description. Uploads are compressed before publication.
2. Publish change and open the page on desktop and mobile. Restore previous version switches that page back one revision. Each page can also display an additional photograph after its first section.
3. Submit a booking, refresh Enquiries and open the new entry. Confirm the team, service and message, then mark it resolved. Test access with both editor and inbox roles.
4. Check account access and the company's retention arrangements before accepting real customer information.

Use Wrangler dev for a local Worker preview. The static preview alone does not run APIs. Remaining features include Drive photo placement, crop controls, media library reuse, adding new portfolio or news entries and assigning enquiries.
