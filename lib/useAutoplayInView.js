'use client';

// Mobile substitute for scroll-scrubbing: autoplays a muted, looping clip only
// while it is on screen, and pauses it otherwise. Scrubbing a video by hand
// janks badly on touch devices, so on mobile the act clips simply play a gentle
// loop instead — motion without the dead scroll.
//
// Decorative by contract, same as useVideoScrub:
//   • `enabled` is false on desktop (the scrub owns the video) and under reduced
//     motion, so this hook is a no-op there — the clip stays on its poster.
//   • Paired with preload="none", but it prefetches: a clip starts buffering
//     ~two screens before it is on screen (the same look-ahead the desktop
//     scrub does), so by the time it plays it has data — no poster→black gap.
//     Without that, the first play() is what fetches the clip and the poster
//     shows black until the first bytes land.

import { useEffect } from 'react';

export function useAutoplayInView({ videoRef, enabled = true, threshold = 0.25, prefetchMargin = '200% 0px' } = {}) {
  useEffect(() => {
    const video = videoRef?.current;
    if (!enabled || !video) return;

    video.muted = true;   // required for autoplay to be allowed on mobile
    video.loop = true;

    // Stage 1 — prefetch: begin buffering ~two screens before the clip is on
    // screen, so it has playable data ready when it arrives. This mirrors the
    // desktop scrub's look-ahead (useVideoScrub). preload='auto' (not just
    // metadata) because a mobile clip plays continuously and needs buffer
    // ahead, not one frame. Fires once, then disconnects.
    let prefetch = null;
    if (video.readyState < 1 /* HAVE_NOTHING/METADATA */) {
      prefetch = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        prefetch.disconnect();
        prefetch = null;
        video.preload = 'auto';
        video.load();
      }, { rootMargin: prefetchMargin });
      prefetch.observe(video);
    }

    // Stage 2 — play only while the clip is actually on screen.
    const play = new IntersectionObserver(
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
    play.observe(video);

    return () => {
      prefetch?.disconnect();
      play.disconnect();
      video.pause();
    };
  }, [videoRef, enabled, threshold, prefetchMargin]);
}
