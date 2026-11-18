# HarkynB staff console

Wrangler builds the public pages and applies the SQLite Durable Object migration. The Worker stores published photos, revisions and private enquiries in one named Durable Object.

## Enable staff access

In Cloudflare open the harkynb-production Worker, then Settings, Variables and Secrets. Add a Secret named STAFF_ACCOUNTS. Set its value to a JSON object keyed by individual usernames. Example structure:

    {"editor-name":{"password":"REPLACE_WITH_RANDOM_PASSWORD","role":"editor"},"inbox-name":{"password":"REPLACE_WITH_DIFFERENT_RANDOM_PASSWORD","role":"inbox"}}

Use individual random passwords. The editor role can publish, inbox can read and resolve enquiries across brands, and manager can do both. Remove an account to revoke access. Open /admin/ over HTTPS and use the browser sign-in prompt. On shared devices use a private window and close it after use. An absent secret leaves the console locked.

## Verify on the deployment

1. Choose a page and select a heading, paragraph or image. Change text or choose a JPEG, PNG or WebP and supply a description. Uploads are compressed before publication.
2. Publish change and open the page on desktop and mobile. Restore previous version switches that page back one revision. Each page can also display an additional photograph after its first section.
3. Submit a booking, refresh Enquiries and open the new entry. Confirm the team, service and message, then mark it resolved. Test access with both editor and inbox roles.
4. Check account access and the company's retention arrangements before accepting real customer information.

Use Wrangler dev for a local Worker preview. The static preview alone does not run APIs. Remaining features include Drive photo placement, crop controls, media library reuse, adding new portfolio or news entries and assigning enquiries.
