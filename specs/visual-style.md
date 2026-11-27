# One calm island look

**Status:** approved by Jordan, 27 November 2026 (#43)
**Vision:** principle 4 (one consistent world); "The world bible: every place on the island described once, with fixed sensory details and an image"; the pipeline's image stage; principle 5 (calm technology).
**Decision (Jordan, 27 November):** both kinds of picture, one for every place and one for every session. "The whole app needs to feel like a relaxing island environment, the pictures attached to sessions and places need to be part of this. We'll need some testing for my approval."
**Checklist items:** `visual-style`, `world-bible`, `weekly-pipeline`

## The rule

The screens and the pictures are one thing. A listener who opens the app, looks at the map and starts a session should feel they are in the same quiet place throughout. So the style is chosen once, by Jordan, from real samples, and then fixed in settings in the way the narrator's voice is.

## What every picture must obey

From `docs/script-guardrails.md`, and unchanged by this spec:

- The scene comes from the place's world-bible entry: its sights, light and time of day. Daylight or soft light, shoreline and land, gentle shallows, paths with a visible way out.
- No faces and no people in distress. No deep water, storms, caves, tunnels, darkness, heights or cliff edges, and nothing that reads as stranded.
- Every picture carries an "AI-generated" credit and alt text that passes the claims rules.

## The style trial

Before any picture is made for release, Jordan sees samples and chooses.

- **Three places** from different regions of `content/places.json`.
- **Three styles**, each described in one fixed sentence that is reused for every picture:
  - **A. Soft watercolour.** Loose washes, pale paper showing through, no hard outlines.
  - **B. Flat illustration.** Simple shapes in a small muted palette, like cut paper.
  - **C. Gentle painted light.** Gouache-like, soft edges, a little more depth and warmth.
- That gives nine pictures. For each style the trial also proposes a **palette of five colours** for the screens, and a **mock of the home screen at 375 px** drawn with it, so pictures and screens are judged together.
- The trial arrives as a pull request with a contact sheet: a table of places by styles. Jordan replies with a letter, or asks for another round with what to change. Nothing in the trial is published.
- Which image service makes the pictures is Jordan's choice (#44); he adds its key.

## Fixed settings

Once Jordan has chosen, the style's model, wording and seed are written into `scripts/pipeline.config.json`. Every later picture uses them. Changing them needs Jordan's approval, as changing the voice does.

## The app's look

- **Colour:** the chosen palette, defined once for light and dark. No pure white or pure black. Text meets WCAG AA contrast.
- **Type:** system fonts, so nothing is downloaded; generous size and line height.
- **Motion:** slow fades only, and none under `prefers-reduced-motion`.
- **Pictures on screens:** today's place on the home page, the session's own picture on its page, and each place's picture on the island map. Every picture has a reserved shape so the page does not jump, loads lazily, and works offline once seen.

## Place images

One picture for each of the 16 places, made once with the fixed settings. Jordan approves them by merging the pull request that adds them. They live in the repo (`public/images/places/`) because the map needs them offline and they are small (at most 150 KB each).

## Session images

One picture for each session, made by the weekly pipeline with the same fixed settings. It shows the session's place as that session finds it, and uses the place's picture as its reference where the image service allows, so the place is recognisably the same. Jordan sees it with the audio at his listen. Session pictures are stored with the audio.

## Not in this spec

Animation or video; pictures of people; a logo; the script, voice or audio.

## Acceptance criteria

1. Jordan can choose a style from one pull request without running anything himself.
2. After the choice, no screen uses a colour outside the palette, and a test checks contrast.
3. All 16 places have an approved picture, with alt text and credit.
4. A session's picture is made with the fixed settings and is shown on its page.
5. No picture is published without Jordan's merge.

## Choices made in drafting

Jordan asked for both kinds of picture, one look across the app, and a trial he approves. These points were chosen here and are approved with this spec: the three candidate styles; three sample places; a palette and screen mock with each style; system fonts; and place pictures kept in the repo while session pictures are stored with the audio (the vision puts images on storage; place pictures are the exception, for offline use).

## Build

The trial (#46), applying the chosen style (#47), the place pictures (#48), and the session picture in the pipeline (#25).
