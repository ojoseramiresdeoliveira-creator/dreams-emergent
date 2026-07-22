// Where the trailer clips (.mp4) are served from.
//
//   • Local / dev: NEXT_PUBLIC_VIDEO_BASE is unset → base is '' → the clips are
//     served from /public/videos as before, so local development is unchanged.
//   • Production: set NEXT_PUBLIC_VIDEO_BASE to the Cloudflare R2 bucket's public
//     URL (no trailing slash needed — we strip it) so the heavy .mp4s come from
//     R2's free-egress CDN instead of the Vercel origin.
//
// Only the .mp4s move. Posters stay in /public (committed, tiny) and are
// referenced by their plain /videos/*.jpg path — they are the SEO / mobile /
// reduced-motion fallback and must ship with the app.
//
//   videoSrc('/videos/act02.mp4') → `${BASE}/videos/act02.mp4`
//
// Always pass a root-relative path beginning with '/'.

const BASE = (process.env.NEXT_PUBLIC_VIDEO_BASE || '').replace(/\/$/, '');

export function videoSrc(path) {
  return `${BASE}${path}`;
}
