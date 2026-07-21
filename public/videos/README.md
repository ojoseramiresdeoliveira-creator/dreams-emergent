# Trailer clips

The scroll-scrub landing is a 5-act trailer. Each act is a decorative,
hand-seeked video layer (see `lib/useVideoScrub.js` + `components/fx/ScrubScene.jsx`)
with server-rendered copy on top. The video is never required to read the page.

## Assets per act

Every act uses three files:

    actNN.mp4         — desktop clip (scrubbed by scroll)
    actNN-mobile.mp4  — mobile clip (served at max-width: 768px)
    actNN-poster.jpg  — poster / mobile / reduced-motion fallback frame

The five acts:

    act01  — anonymous life        (the boy, seated by the window)
    act02  — sacrifice             (the hand writing under the lamp)
    act03  — the climb             (the figure climbing the stair)
    act04  — the monument
    act05  — the invitation

## What's in git vs. local-only

| File                | Tracked? | Where it comes from            |
|---------------------|----------|--------------------------------|
| `actNN-poster.jpg`  | ✅ yes   | committed — every clone has it |
| `actNN.mp4`         | ❌ no    | encoded locally / served from CDN |
| `actNN-mobile.mp4`  | ❌ no    | encoded locally / served from CDN |
| `*.mov` (masters)   | ❌ no    | source masters — never committed |

Git-ignored patterns live in `.gitignore` (`/public/videos/*.mp4`, `/public/videos/*.mov`).
Posters are the fallback, so a fresh clone renders every act on its poster
even before the `.mp4`s are present — the page is fully readable without them.

## What a new machine needs locally

1. Clone the repo — you already have all `actNN-poster.jpg`.
2. Drop the `.mp4` clips into this folder (from CDN or a shared drive), or
   re-encode them from the `.mov` masters (see below). Each act needs both
   `actNN.mp4` and `actNN-mobile.mp4`.
3. `npm install` (the scrub engine needs `gsap` + `lenis`), then `npm run dev`.

Without the `.mp4`s the site still runs — you just see posters instead of the
scrubbed motion.

## Encoding guidelines

Web-encode each `.mov` master with ffmpeg:

    # desktop — cap the long edge at ~1600px
    ffmpeg -i actNN.mov -c:v libx264 -profile:v high -pix_fmt yuv420p \
      -crf 24 -preset slow -an -movflags +faststart \
      -vf "scale='min(1600,iw)':-2" actNN.mp4

    # mobile — 720px wide, a touch more compression
    ffmpeg -i actNN.mov -c:v libx264 -profile:v high -pix_fmt yuv420p \
      -crf 26 -preset slow -an -movflags +faststart \
      -vf "scale=720:-2" actNN-mobile.mp4

    # poster — a strong frame, native resolution
    ffmpeg -ss <sec> -i actNN.mov -frames:v 1 -q:v 3 actNN-poster.jpg

Rules of thumb:
- H.264 / MP4, ~6–10s, target ≤ 2 MB per desktop clip.
- Muted, no audio track (clips are decorative and hand-seeked).
- Static assets served with `preload` gated per act — never bundled.

## Status

    act01  ✅ mp4 · ✅ mobile · ✅ poster
    act02  ✅ mp4 · ✅ mobile · ✅ poster
    act03  ✅ mp4 · ✅ mobile · ✅ poster
    act04  — pending
    act05  — pending

(`.mp4`s are local-only, so "✅" means the poster is committed and the clips
have been encoded on at least one machine — grab them from CDN/shared drive.)
