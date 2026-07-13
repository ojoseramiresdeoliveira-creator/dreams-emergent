# Monument of Dreams — Living Experience Upgrade Plan

Goal: elevate the product to a living, cinematic, premium experience — every user
action gets an elegant visual response — **without changing the product identity**
(Obsidian Black `#0A0A0B` + Champagne Gold `#D4B06A` + Platinum White `#F5F5F3`)
and **without touching backend, Supabase, Guardian, APIs or business logic**.
Visual layer only: `app/page.js`, `app/globals.css`, `app/layout.js`,
`components/`, `lib/motion.js`, `public/` assets.

Stack facts: Next.js 15 (single-page client app in `app/page.js`, ~1.4k lines),
Tailwind 3.4, framer-motion 11.18 (already used heavily), shadcn/Radix, canvas
Starfield, CSS motion tokens already in `globals.css` (`--ease-out`, `--dur-*`).

---

## Fase 1 — Fundação viva: sistema de movimento + microinterações globais ✅ (implemented)

One shared motion vocabulary + physical feedback on every interactive surface.

- `lib/motion.js` — central motion tokens: easings, durations, springs, shared
  framer-motion variants (`fadeUp`, `stagger`), viewport presets. All later
  phases import from here instead of hardcoding `[0.16, 1, 0.3, 1]`.
- `components/fx/` primitives (all respect `prefers-reduced-motion`):
  - `SpotlightController` — one document-level pointer listener that drives a
    champagne light that follows the cursor across any element with the
    `.spotlight` class (dynamic lighting on glass cards).
  - `TiltCard` — subtle 3D tilt with spring physics (material/physical feel).
  - `Magnetic` — magnetic attraction on primary CTAs.
  - `Reveal` — standard scroll-reveal wrapper for later phases.
- `globals.css` — `.spotlight` (cursor-following light), `.input-lux`
  (champagne underline that grows on focus), wired existing-but-unused
  `.sidebar-item` indicator.
- Applied across `page.js`: spotlight on glass cards (Home, Timeline, Profile,
  Community, sidebar), Magnetic on hero/final CTAs, TiltCard on community
  cards, `input-lux` on Onboard/Auth inputs, `btn-premium` press feedback on
  primary action buttons, sidebar active indicator.

## Fase 2 — Landing cinematográfica ✅ (implemented)

Hero and landing sections become a continuous cinematic scene.

- Deeper scroll choreography: multi-layer parallax (Earth, starfield, text at
  different depths), scroll-linked section transitions using `useScroll`.
- Subtle particle drift upgrade on Starfield (shooting star occasionally,
  champagne dust motes near the Earth).
- Letter/line-level text reveals on serif headlines (masked rise).
- Image treatment: gradient-mesh light sweeps over `SectionCinematic`,
  optimized 4K stills (AVIF/WebP with blur-up placeholders replacing raw
  Unsplash hotlinks).

## Fase 3 — Interior vivo: dashboard, timeline, onboarding ✅ (implemented)

- Shared-element feel between views: choreographed enter/exit per view
  (Shell content stagger, sidebar indicator slide).
- Timeline as a living monument: stones materialize (mask + rise), timeline
  line draws itself on scroll, entry icons glow on hover with light bloom.
- Onboarding rite: chapter transitions with cinematic crossfade, progress
  hairline animates like an engraving, celebratory moment when the Monument
  is raised (particle burst in champagne, restrained).
- Number counters and stat cards animate on mount with springs.

## Fase 4 — Guardian vivo

- Message entrance physics (spring rise, soft glow pulse on new Guardian
  reply), streaming-style text reveal for replies.
- Ambient presence: faint breathing halo behind the chat while the Guardian
  "thinks", upgraded typing indicator.
- Input bar: focus glow, send button morphs to spinner and back.

## Fase 5 — Performance, assets e polish 60fps

- Asset pass: self-hosted optimized images (AVIF/WebP, responsive sizes,
  blur placeholders), optional ambient hero video (muted, poster fallback).
- 60fps audit: only `transform`/`opacity` animations, `will-change` hygiene,
  devtools performance trace on low-end profile.
- Reduced-motion + mobile pass, final consistency sweep of easing/duration
  across all views.

---

Rule for every phase: complete → validate (build + visual check) → only then
advance to the next phase.
