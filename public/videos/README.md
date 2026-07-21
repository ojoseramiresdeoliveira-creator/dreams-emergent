# Trailer clips

The scroll-scrub trailer expects the 5 act clips here:

    act01.mp4  — anonymous life
    act02.mp4  — sacrifice
    act03.mp4  — the climb
    act04.mp4  — the monument
    act05.mp4  — the invitation

Phase 1 uses a single placeholder:

    placeholder.mp4  — any short muted clip; drives /scrub-demo

Guidelines (see Phase 0 diagnostic):
- H.264/MP4, ~6–10s, target ≤2 MB per clip.
- Muted, no audio track needed (they are decorative and hand-seeked).
- These are static assets served with `preload` gated per act — never bundled.

Clips are intentionally git-ignored; drop them locally / serve from CDN.
