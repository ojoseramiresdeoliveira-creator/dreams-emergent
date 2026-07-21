'use client';

// Maps scroll position across a track element onto a <video>'s currentTime,
// turning a clip into a scroll-scrubbable layer. This is the engine behind the
// 5-act trailer; the act sections plug their own <video> and copy into it.
//
// Progressive enhancement, always:
//   • The video is decoration. Copy lives in the DOM regardless of this hook.
//   • Scrubbing is DISABLED under prefers-reduced-motion and on coarse-pointer
//     / small-viewport devices (mobile), where per-frame seeks jank badly. In
//     that mode the clip is left on its poster/first frame and the section
//     reads as a static, captioned still — same content, no motion cost.
//
// Usage:
//   const videoRef = useRef(null);
//   const trackRef = useRef(null);
//   const { active, progress } = useVideoScrub({ videoRef, trackRef });

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// A frame this small isn't worth a seek — avoids hammering the decoder with
// sub-perceptual currentTime writes on every scroll tick.
const SEEK_EPSILON = 1 / 60;

export function shouldScrub() {
  if (typeof window === 'undefined') return false;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = window.matchMedia('(max-width: 768px)').matches;
  return !reduce && !coarse && !small;
}

export function useVideoScrub({ videoRef, trackRef, enabled = true } = {}) {
  const [active, setActive] = useState(false);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef?.current;
    const track = trackRef?.current;
    if (!enabled || !video || !track) return;

    if (!shouldScrub()) {
      // Fallback: hold the clip on its first frame, never play. The poster (or
      // this frame) carries the section; scroll drives nothing.
      setActive(false);
      video.pause?.();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    setActive(true);
    // We seek this video by hand; it must never autoplay or make sound.
    video.pause();
    video.muted = true;

    let st;
    const applyProgress = (p) => {
      progressRef.current = p;
      setProgress(p);
      const duration = video.duration;
      if (!duration || Number.isNaN(duration)) return;
      const t = p * duration;
      if (Math.abs(video.currentTime - t) > SEEK_EPSILON) {
        video.currentTime = t;
      }
    };

    const build = () => {
      st = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => applyProgress(self.progress),
      });
      applyProgress(st.progress);
    };

    // Need the duration before we can map progress → time.
    if (video.readyState >= 1 /* HAVE_METADATA */) {
      build();
    } else {
      const onMeta = () => build();
      video.addEventListener('loadedmetadata', onMeta, { once: true });
      return () => {
        video.removeEventListener('loadedmetadata', onMeta);
        st?.kill();
      };
    }

    return () => st?.kill();
  }, [videoRef, trackRef, enabled]);

  return { active, progress };
}
