'use client';

// Reusable backdrop for the trailer's video acts (2–5). A clip is pinned in a
// tall sticky track and scrubbed by scroll while the slotted copy stays put —
// and server-rendered — above it.
//
// The video is pure decoration: under reduced motion / on mobile the track
// collapses to a normal ~100svh section, so the copy never depends on it
// (SEO-safe, same contract as the Act 1 hero). Desktop scrubs the clip by
// scroll; on mobile the clip autoplays a gentle muted loop while it is on
// screen instead (no dead scrub track, no frozen poster) — exactly the Act 1
// hero's mobile behaviour.
//
//   <ScrubScene id="ethos" videoBase="act02" poster="/landing/ethos-2560.webp">
//     {…copy…}
//   </ScrubScene>

import { useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useVideoScrub } from '@/lib/useVideoScrub';
import { useAutoplayInView } from '@/lib/useAutoplayInView';
import { useIsMobile } from '@/hooks/use-mobile';
import { videoSrc } from '@/lib/videoSrc';

export default function ScrubScene({
  id,
  videoBase,            // 'act02' → /videos/act02.mp4 (+ /videos/act02-mobile.mp4)
  poster,
  trackVh = 220,        // ≈120vh of pinned scrub — tight pacing, no dead scroll
  overlay = 'bg-gradient-to-b from-black/40 via-black/10 to-black/45',
  children,
}) {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const trackRef = useRef(null);
  const videoRef = useRef(null);
  // Desktop hand-seeks the clip from the tall track; mobile plays a muted loop
  // in view instead. Only one of the two is ever enabled.
  useVideoScrub({ videoRef, trackRef, enabled: !isMobile });
  useAutoplayInView({ videoRef, enabled: isMobile });

  // Mobile (and reduced motion) collapse the scrub track to a normal section so
  // there is no dead scroll and no black void beneath a frozen frame.
  const flat = reduce || isMobile;

  return (
    <div ref={trackRef} className="relative" style={flat ? undefined : { height: `${trackVh}vh` }}>
      <section
        id={id}
        className={`overflow-hidden flex items-center justify-center bg-black ${flat ? 'relative min-h-[100svh]' : 'sticky top-0 h-screen'}`}
      >
        {/* decorative clip — desktop + mobile sources, held on its poster when
            the scrub is disabled. Never carries content. */}
        <video
          ref={videoRef}
          aria-hidden
          muted
          playsInline
          preload="none"
          poster={poster}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src={videoSrc(`/videos/${videoBase}-mobile.mp4`)} media="(max-width: 768px)" type="video/mp4" />
          <source src={videoSrc(`/videos/${videoBase}.mp4`)} type="video/mp4" />
        </video>
        {/* legibility scrim so the copy reads over any frame */}
        <div aria-hidden className={`absolute inset-0 pointer-events-none ${overlay}`} />
        {/* edge fades — each clip melts to pure black at the top and bottom so
            adjacent acts bleed into one another instead of showing a seam. The
            section background is black too, so the boundary between two acts is
            a continuous stretch of black: one film, not stacked stills. */}
        <div aria-hidden className="absolute top-0 inset-x-0 h-16 md:h-24 pointer-events-none bg-gradient-to-b from-black to-transparent" />
        <div aria-hidden className="absolute bottom-0 inset-x-0 h-16 md:h-24 pointer-events-none bg-gradient-to-t from-black to-transparent" />
        <div className="relative w-full">{children}</div>
      </section>
    </div>
  );
}
