'use client';

// Reusable backdrop for the trailer's video acts (2–5). A clip is pinned in a
// tall sticky track and scrubbed by scroll while the slotted copy stays put —
// and server-rendered — above it.
//
// The video is pure decoration: under reduced motion / on mobile the track
// collapses to a normal section and the clip holds on its poster, so the copy
// never depends on it (SEO-safe, same contract as the Act 1 hero).
//
//   <ScrubScene id="ethos" videoBase="act02" poster="/landing/ethos-2560.webp">
//     {…copy…}
//   </ScrubScene>

import { useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useVideoScrub } from '@/lib/useVideoScrub';

export default function ScrubScene({
  id,
  videoBase,            // 'act02' → /videos/act02.mp4 (+ /videos/act02-mobile.mp4)
  poster,
  trackVh = 320,        // ≈220vh of pinned scrub — paces a ~10s clip like Act 1
  overlay = 'bg-gradient-to-b from-black/60 via-black/25 to-black/70',
  children,
}) {
  const reduce = useReducedMotion();
  const trackRef = useRef(null);
  const videoRef = useRef(null);
  useVideoScrub({ videoRef, trackRef });

  return (
    <div ref={trackRef} className="relative" style={reduce ? undefined : { height: `${trackVh}vh` }}>
      <section
        id={id}
        className={`overflow-hidden flex items-center justify-center bg-black ${reduce ? 'relative min-h-screen' : 'sticky top-0 h-screen'}`}
      >
        {/* decorative clip — desktop + mobile sources, held on its poster when
            the scrub is disabled. Never carries content. */}
        <video
          ref={videoRef}
          aria-hidden
          muted
          playsInline
          preload="metadata"
          poster={poster}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src={`/videos/${videoBase}-mobile.mp4`} media="(max-width: 768px)" type="video/mp4" />
          <source src={`/videos/${videoBase}.mp4`} type="video/mp4" />
        </video>
        {/* legibility scrim so the copy reads over any frame */}
        <div aria-hidden className={`absolute inset-0 pointer-events-none ${overlay}`} />
        <div className="relative w-full">{children}</div>
      </section>
    </div>
  );
}
