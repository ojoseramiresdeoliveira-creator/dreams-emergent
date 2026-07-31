'use client';

// Reusable backdrop for the trailer's video acts (2–5). A clip fills a normal
// ~100svh section while the slotted copy stays put — and server-rendered —
// above it.
//
// The video is pure decoration: on every device the clip autoplays a gentle
// muted loop while it is on screen and pauses off-screen — no scroll scrub, no
// tall pinned track. Under reduced motion it opts out and holds the poster, so
// the copy never depends on it (SEO-safe, same contract as the Act 1 hero).
//
//   <ScrubScene id="ethos" videoBase="act02" poster="/landing/ethos-2560.webp">
//     {…copy…}
//   </ScrubScene>

import { useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useAutoplayInView } from '@/lib/useAutoplayInView';
import { videoSrc } from '@/lib/videoSrc';

export default function ScrubScene({
  id,
  videoBase,            // 'act02' → /videos/act02.mp4 (+ /videos/act02-mobile.mp4)
  poster,
  overlay = 'bg-gradient-to-b from-black/25 via-black/8 to-black/30',
  children,
}) {
  const reduce = useReducedMotion();
  const videoRef = useRef(null);
  // Desktop and mobile alike: the clip autoplays a gentle muted loop while it
  // is on screen and pauses off-screen — one coherent behaviour, no scroll
  // scrub. Reduced motion opts out and holds the poster instead.
  useAutoplayInView({ videoRef, enabled: !reduce });

  return (
    <div className="relative bg-black">
      <section
        id={id}
        className="overflow-hidden flex items-center justify-center bg-black relative min-h-[100svh]"
      >
        {/* decorative clip — desktop + mobile sources, held on its poster under
            reduced motion. Never carries content. */}
        <video
          ref={videoRef}
          aria-hidden
          muted
          playsInline
          preload="none"
          poster={poster}
          className="clip-melt brightness-105 absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src={videoSrc(`/videos/${videoBase}-mobile.mp4`)} media="(max-width: 768px)" type="video/mp4" />
          <source src={videoSrc(`/videos/${videoBase}.mp4`)} type="video/mp4" />
        </video>
        {/* legibility scrim so the copy reads over any frame */}
        <div aria-hidden className={`absolute inset-0 pointer-events-none ${overlay}`} />
        {/* The clip itself carries a top/bottom mask (.clip-melt) that dissolves
            its edges into the black section background, so adjacent acts bleed
            into one another with no seam — one film, not stacked stills. */}
        <div className="relative w-full">{children}</div>
      </section>
    </div>
  );
}
