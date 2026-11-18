# Content guide

All configuration examples below are illustrative structures. Do not publish sample names as real clients or projects. Add only content the company has approved and has permission to publish.

## Core settings

`reviewMode`: `true` keeps the review banner and noindex directives. It does not make the site private.

`siteUrl`: the final HTTPS origin, without a trailing slash.

`logo`: an approved asset path, such as `/brand/harkynb-production.png`, shown on light backgrounds. Empty uses a text wordmark.

`logoOnDark`: a light version of the logo for the dark footer. Empty reuses `logo`.

`heroVideo`: reserved for a future approved hero montage. This first version uses an abstract CSS composition; it does not play video.

## Contact routing

The five team keys are `production`, `onevoicefm`, `shotit`, `academy`, and `summit`. Each supports an `email` and a `whatsapp` number in international digits only, with no plus sign or spaces. Keep an entry empty until verified. This enables explicit visitor-controlled draft links, not automatic submissions.

`socials` entries use `{ "label": "Platform name", "url": "https://..." }`.

## Projects

Once staff publish the portfolio or news list in the staff console (Portfolio & news), the published list replaces `projects` or `news` from this file on the live site, and edits here no longer appear. Make further changes in the console. Restoring the first published version returns to this file's content.

```json
{
  "slug": "unique-approved-project-slug",
  "title": "Approved project title",
  "category": "Weddings",
  "description": "Approved project summary",
  "location": "Approved location",
  "services": "Services actually delivered",
  "team": "shotit",
  "image": "/media/project-cover.webp",
  "alt": "A useful description of the photograph",
  "credit": "Authorised photographer credit",
  "gallery": [
    { "title": "Approved caption", "category": "Weddings", "image": "/media/project-detail.webp", "alt": "Description" }
  ]
}
```

Optional `team` (`production`, `onevoicefm`, `shotit`, `academy`, `summit`) sets which team receives "Plan a similar project" enquiries; it defaults to `production`. Set `credit` to the brand that produced the work, such as `HarkynBShotIt`.

Add these to `projects`. Allowed categories: Weddings, Corporate, Conferences, Portraits, Brands, Music Videos, Film, Livestreaming, Behind the Scenes, Training. Slugs must be unique lowercase letters, digits, and single hyphens. Gallery entries should not contain a slug unless they refer to an actual configured project. All images must exist in `public/` or use approved HTTPS URLs.

`students` uses the same image/card structure without `slug`, with category Photography, Film, Editing, or Content. Credit the student and obtain permission.

## Summit

`summitPhotos` uses image/card entries without `slug`. Categories: The Gathering, The Opening, Keynote Sessions, Photography Panel, Video Editor Panel, Filmmaker Panel, Content Creator Panel, Fireside Chat, Networking, Behind the Scenes, Group Photographs.

`speakers` entries: `name`, `title`, `bio`, `session`, `category`, and optional `image`. Only add confirmed Summit 1.0 speakers. Category filters derive from the entries.

`summitVideos` entries: `title` and an approved official HTTPS recording `url`. Links open official recordings. Videos are not downloaded or re-hosted automatically.

`nextSummit`: `date`, `venue`, and `registrationUrl`. The registration link appears only when a date and registration URL are set. No countdown is generated.

## Radio

`radio.streamUrl`: an HTTPS audio stream compatible with the browser's native audio player. An ordinary station homepage or streaming dashboard URL is not an audio stream. Test playback, licensing arrangements, mobile browsers, and error handling after configuration. Empty disables listening truthfully.

`radio.nowPlaying`: a manually updated programme label, not an automatic schedule feed.

`radio.programmes`: entries with `title`, `description`, `host`, `schedule`.

`radio.episodes`: entries with `title`, `description`, and audio `url`.

## News

`news` entries use `title`, `description`, `date`, and an optional approved HTTPS `url` to the full update.

## Course details

Course direction and curriculum live in `content/catalogue.mjs`. The six detail pages deliberately show dates, fees, delivery, trainers, duration, and certification as unannounced. Update the page template and verified course data together when actual cohorts are confirmed. The current form collects interest drafts, not paid registrations.

After changes: run `npm run build` then `npm test`. Commit changes to the connected branch to trigger Cloudflare's configured Git deployment.

## Enquiry forms

Each team has its own contact form, defined in `shared/forms.mjs`. The contact page, the server check and the staff inbox all read that one file, so edit questions there only.

- **HarkynB Production**: service needed, date, location, budget.
- **Onevoicefm**: company, advertising or partnership interest, timing, budget.
- **HarkynBShotIt**: type of shoot, date, venue, guests, budget.
- **Creators Academy**: asks who is enquiring first. Students and parents give age group, city, programmes of interest (from the Academy course list), experience, occupation, learning format, schedule, equipment and how they heard about the Academy; students under 18 must add a parent or guardian contact. Schools give organisation, learner numbers, ages, programmes and timing. Sponsors choose how they would like to help.
- **Future Creators Summit**: general enquiries and partnership or sponsorship only. Partners give their organisation and partnership areas.

Links such as `/contact/?team=academy&service=Photography` open the right form with answers already chosen; the `aliases` in each form map link wording to answers.
