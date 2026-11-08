# The Island — vision

*Draft for Jordan's review, 8 November 2026. Once approved, this is the contract: agents may not change it, and every issue and PR is judged against it.*

## What it is

A free, installable web app of short, story-based guided relaxation sessions. Each session takes you to a place on one fictional island (a quiet beach at first light, a garden path, a sunlit jetty over gentle shallows) and walks you gently through it. The sessions form a **100-day programme**: one island, slowly explored, with a new session about every week.

It is relaxation practice, informed by the evidence on guided imagery. It is **not** a treatment, and it never says it is.

## Who it's for

- **First:** an adult who wants ten calm minutes in the evening or on a break and finds blank-screen meditation hard. They're on a phone, often with headphones, sometimes already a little on edge. Anxious listeners are the most likely to be harmed by careless meditation, so the app is built for them first.
- **Second:** someone visiting Jordan's portfolio, who should see a careful, safety-first content pipeline: AI used to write and voice, with hard rules and a human listening before anything ships.

## The core journey (what "working" means)

1. **Land:** understand in five seconds what this is ("short guided escapes to a calm island") and what it isn't (not therapy).
2. **Choose:** today's session is obvious; earlier ones are easy to revisit from the island map.
3. **Rate before:** one tap, "How calm do you feel right now?" (optional, skippable).
4. **Listen:** audio starts within two seconds, works with the screen off, can be paused and resumed, and offers eyes-open or eyes-closed at the start.
5. **Rate after and return:** one tap for how you feel now, a gentle close, and the island map shows where you've been. Progress lives on the device; there's no account.

## Principles

1. **Safety before atmosphere.** Every script passes [`docs/script-guardrails.md`](script-guardrails.md): invitational language, permission to stop at the start and midway, no deep water, storms, caves, darkness, cliffs or "no way off". When in doubt, gentler.
2. **No claims.** "Evidence-informed relaxation", never "treats", "reduces anxiety", "therapy" or a named condition. This applies to the app, episode notes, images and social copy.
3. **A person listens before anything is published.** Generation is automated; publishing is never automatic. Jordan approves each script before voicing and each finished episode before release.
4. **One consistent world.** A world bible fixes each place's sights, sounds and textures, so returning to a place feels like coming back, not a new random scene. Same voice, same settings, every session.
5. **Calm technology.** No streaks, badges, notifications by default, ads or tracking. Fully static, fast on a weak connection, works offline once a session is saved.

## Done for 2026 (the `done-2026` milestone)

The app is **done** when all of these are true:

- [ ] **Live** at a public URL as an installable PWA (Astro + a small Svelte audio player on Cloudflare; audio and images on R2).
- [ ] **The 100-day curriculum map:** all 100 days planned by phase (what each phase practises, session length, maximum silence), with the place each session visits.
- [ ] **The world bible:** every place on the island described once, with fixed sensory details and an image.
- [ ] **Phase 1 published:** about 6 sessions released weekly from mid-November, each passing the guardrails, the automated safety lint, a model safety review and Jordan's listen.
- [ ] **The content pipeline runs weekly** as a GitHub Action: script → lint → safety review → Jordan's approval → voice → silences and mastering (−16 LUFS) → image → publish, within about US$5 a week.
- [ ] **Before-and-after calm rating** on every session, stored on the device, with an optional anonymous share of the two numbers only.
- [ ] **Accessible and calm to use:** works at 375 px, keyboard and screen-reader friendly, reduced motion respected, transcripts for every session.
- [ ] **Signposting:** a short "if you need more support" page, written by a person (never generated), linked from every session.
- [ ] **Portfolio-ready:** a case study on the safety-first content pipeline and an embedded sample session on the portfolio site.

## Not in 2026

Accounts or cross-device sync; payments; sleep stories longer than about 20 minutes; music-only tracks; user-written scripts; live AI generation in the app; push notifications; languages other than English; any clinical or "programme for anxiety" positioning.

## Open questions for Jordan

1. **Session length:** 8–12 minutes for phase 1, growing slowly? (Recommended: start at 8, cap phase 1 at 12.)
2. **Voice:** one narrator voice for the whole island, or one per region? (Recommended: one voice, for consistency.)
3. **Sharing calm ratings:** off by default with an opt-in, or not at all in 2026? (Recommended: opt-in, anonymous, two numbers only.)
4. **Name and domain:** keep "The Island", or something more distinctive? Subdomain of the portfolio domain?

## Order of work

1. **Foundations (week 1):** scaffold Astro + the audio player, `.ops.yml`, CI, a preview deploy; write the world bible and the 100-day map.
2. **Pipeline (weeks 1–2):** the script → lint → review → approval → audio → image chain, run once end to end on a test session.
3. **Phase 1 (weeks 2–7):** one session a week, each approved by Jordan; the calm rating and island map.
4. **Launch (weeks 6–7):** accessibility pass, signposting page, design critique, the portfolio case study.
