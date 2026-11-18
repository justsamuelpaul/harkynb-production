# HarkynB Production website next steps

The existing website generates its pages from repository files. The enquiry form currently prepares a visitor-controlled draft. The following work is planned.

| Order | Owner | Deliverable | Acceptance check |
| --- | --- | --- | --- |
| 1 | HarkynB team | Supply approved logos, photographs, captions, credits, usage permissions, brand contact details, and named staff who may publish content or read enquiries. Confirm course and Summit details and supply the Onevoicefm stream URL when available. | Each asset and enquiry recipient is assigned to the correct brand. |
| 2 | Development team | Build a staff console at `/admin` covering the parent website and four brands. Sign in with individual staff accounts. Enforce publishing and enquiry permissions on the server. | An authorised editor can sign in. A signed-out visitor cannot access drafts, uploads, or submissions through either the console or its API. |
| 3 | Development team | Let editors update page copy, services, news, courses, portfolio entries, and Summit content. Provide a media library to upload, preview, replace, reorder, and caption pictures, including alt text and photographer credits. Seed the editor with existing content. | An editor changes a headline and replaces a gallery photo, previews both, publishes them to the correct page, and can restore the previous version without editing code. |
| 4 | Development team | Connect public enquiry forms to a private staff inbox. Preserve the chosen team, service, completed fields, and submission time. Cover bookings, training interest, advertising, and partnerships. Add validation, spam controls, and duplicate-submit protection. | A mobile visitor submits a test booking and sees confirmation only after it is saved. The correct staff member sees it once, can filter by brand, assign follow-up, and mark it resolved. Failed submissions keep the visitor’s entries for retry. |
| 5 | HarkynB team and development team | Confirm privacy wording, retention and deletion rules, and which team members receive notifications. Verify desktop and mobile layouts, published content, image loading, and enquiry delivery on the Cloudflare URL. | HarkynB completes a publish-and-enquire walkthrough on the deployed site before review mode is removed. |

## Proposed Cloudflare implementation

Keep the existing public URLs. Use a Worker API for publishing and form intake, D1 for structured content and enquiries, and R2 for images. Keep unpublished media private and serve only approved assets publicly. Store personal enquiry details outside the public GitHub repository and static build. Connect the public pages to published content and verify that publication refreshes the live pages.

## First working milestone

Deliver one complete workflow for HarkynBShotIt. A staff member publishes an updated portfolio photo, a visitor submits a shoot enquiry from that page, and the assigned team can read the completed form in the console. Use that workflow to verify permissions, publishing, and delivery before extending it to the other brands.
