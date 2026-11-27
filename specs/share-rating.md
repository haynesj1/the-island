# Sharing the two calm numbers

**Status:** approved by Jordan, 27 November 2026 (#43)
**Vision:** "Before-and-after calm rating on every session, stored on the device, with an optional anonymous share of the two numbers only"; principle 5 (calm technology: no tracking).
**Decisions:** opt-in, anonymous, two numbers only (#10, 9 November); build a small endpoint for it in 2026 (27 November).
**Checklist item:** `share-rating`

## What the listener sees

After the second rating, once per session, one quiet line under the close:

> Share these two numbers anonymously? They help show whether sessions like this one feel calming. Nothing else is sent.
>
> **Share** · **Not now**

- Not now is the default. Nothing is sent unless the listener taps Share.
- After either choice the line goes away for that session. There is no reminder and no count of how often they shared.
- Settings has one switch, "Ask to share my calm numbers", on by default. Off means the line never appears.
- The wording makes no claim that the app reduces anxiety or treats anything.

## What is sent

Exactly three whole numbers: the session's day in the programme, the rating before (1 to 5) and the rating after (1 to 5). No account, device identifier, cookie, timestamp or free text.

## What is stored

Counts only. For each day and each pair of ratings the endpoint keeps one number: how many times that pair was shared (for example "day 3, before 2, after 4: 17"). There is no row per listener, so there is nothing to link, export or delete for a person. The visitor's network address is used by Cloudflare to deliver the request and is not written anywhere by this code.

## Where

A small Cloudflare Worker in this repo (`worker/share/`) with a key-value store. It:

- accepts one `POST` with `{ day, before, after }` and rejects anything else, including extra fields and out-of-range numbers;
- answers only the app's own web address;
- has no endpoint that reads the counts. Jordan reads them in the Cloudflare dashboard.

The app finds the endpoint through one public build setting, `PUBLIC_SHARE_URL`. When it is not set, the line is never shown, so the app is complete without the Worker.

## When it fails

If the phone is offline or the request fails, nothing is shown and nothing is retried. The on-device rating is kept either way.

## Not in this spec

Showing totals to listeners; any chart or claim built on the counts; accounts; sending anything other than the three numbers.

## Acceptance criteria

1. No request leaves the device before a tap on Share, proved by a network-capture test.
2. The Worker stores only counts keyed by day, before and after, and rejects every other shape of request.
3. With `PUBLIC_SHARE_URL` unset, the app shows no share line and makes no request.
4. A failed request changes nothing the listener can see.
5. The settings switch stops the line appearing, and the choice is kept on the device.
6. The line works at 375 px, by keyboard and with a screen reader.

## Choices made in drafting

Jordan chose "build a small endpoint" and left the detail to this spec. These three points were chosen here and are approved with it: counts only, with no row per share; no way for the app to read the counts back; and the line is hidden entirely when the endpoint is not set up.

## Build

One issue (#49). Deploying the Worker and setting `PUBLIC_SHARE_URL` are Jordan's steps.
