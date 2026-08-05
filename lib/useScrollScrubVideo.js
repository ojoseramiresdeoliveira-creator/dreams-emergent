'use client';

import { useEffect, useRef } from 'react';
import { useScroll, useSpring } from 'framer-motion';

// Drives a <video>'s currentTime from scroll position across a tall track,
// instead of a scroll-triggered play/pause. This exact idea was tried once
// before on this landing and removed (see git history: 254f3af "at 24fps the
// per-frame seek across three screens read as a stuttery gallery") — the two
// mitigations here are aimed directly at that failure mode:
//
//   1. scrollYProgress is smoothed through a spring before it ever touches
//      the video, so a fast flick/trackpad fling doesn't demand a burst of
//      instantaneous seeks — the video "catches up" instead of jumping.
//   2. The spring's own 'change' event already fires at requestAnimationFrame
//      cadence (that's how framer-motion drives springs), so currentTime is
//      never written more than once per frame — never once per raw wheel/
//      scroll event.
//
// The desktop clip (components/fx/JourneyScrub.jsx) is also re-encoded with a
// keyframe on every frame (GOP=1) specifically so every seek lands on a
// keyframe instead of forcing a decode chain from the last one.
//
// `enabled` gates everything (desktop + !reduced-motion, decided by the
// caller). Disabled, the hook still returns the progress MotionValue but
// never touches the video. Returns the smoothed progress so the caller can
// drive text-block opacity from the exact same source instead of a second,
// potentially-desynced scroll listener.
export function useScrollScrubVideo({ trackRef, videoRef, enabled = true }) {
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 300, damping: 40, mass: 0.4 });
  const primed = useRef(false);

  // Warm the video up once metadata is ready: a silent play() + immediate
  // pause(). Without this, the first currentTime write is ignored by some
  // browsers because nothing has actually been decoded yet.
  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video || primed.current) return;
    function prime() {
      if (primed.current) return;
      primed.current = true;
      const p = video.play();
      if (p && typeof p.then === 'function') p.then(() => video.pause()).catch(() => {});
      else video.pause();
    }
    if (video.readyState >= 1) {
      prime();
      return undefined;
    }
    video.addEventListener('loadedmetadata', prime, { once: true });
    return () => video.removeEventListener('loadedmetadata', prime);
  }, [enabled, videoRef]);

  useEffect(() => {
    if (!enabled) return undefined;
    const unsub = progress.on('change', (latest) => {
      const video = videoRef.current;
      if (!video || !video.duration || Number.isNaN(video.duration)) return;
      const clamped = Math.min(Math.max(latest, 0), 1);
      video.currentTime = clamped * video.duration;
    });
    return unsub;
  }, [enabled, progress, videoRef]);

  return progress;
}
