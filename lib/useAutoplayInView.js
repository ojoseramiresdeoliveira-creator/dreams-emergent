'use client';

// Mobile substitute for scroll-scrubbing: autoplays a muted, looping clip only
// while it is on screen, and pauses it otherwise. Scrubbing a video by hand
// janks badly on touch devices, so on mobile the act clips simply play a gentle
// loop instead — motion without the dead scroll.
//
// Decorative by contract, same as useVideoScrub:
//   • `enabled` is false on desktop (the scrub owns the video) and under reduced
//     motion, so this hook is a no-op there — the clip stays on its poster.
//   • Paired with preload="none": the first play() is what fetches the clip, so
//     nothing loads until the act actually scrolls into view.

import { useEffect } from 'react';

export function useAutoplayInView({ videoRef, enabled = true, threshold = 0.25 } = {}) {
  useEffect(() => {
    const video = videoRef?.current;
    if (!enabled || !video) return;

    video.muted = true;   // required for autoplay to be allowed on mobile
    video.loop = true;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const p = video.play();
          if (p && typeof p.catch === 'function') p.catch(() => {}); // ignore autoplay rejections
        } else {
          video.pause();
        }
      },
      { threshold }
    );
    io.observe(video);

    return () => {
      io.disconnect();
      video.pause();
    };
  }, [videoRef, enabled, threshold]);
}
