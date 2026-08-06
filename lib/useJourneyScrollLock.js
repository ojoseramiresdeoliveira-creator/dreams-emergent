'use client';

// True scroll-hijack for the 5-act journey (desktop only). Replaces the
// passive-observer model of the old useScrollScrubVideo.js: instead of
// reading whatever the native scroll position happens to be, this freezes
// the real page scroll the moment the acts zone is entered, and drives an
// internal 0→1 progress value entirely from wheel/keydown input until the
// user reaches either end — only then is native scroll handed back.
//
// Coordination with Lenis (components/fx/SmoothScroll.jsx), three layers:
//   1. document.documentElement/body get `overflow: hidden` while locked —
//      the real, physical guarantee that the page cannot move, regardless of
//      what triggered the input (wheel, keyboard, a stray scrollbar drag).
//   2. lenis.stop()/start() pauses Lenis's own animation loop for the same
//      window, so it isn't doing wasted/conflicting work underneath.
//   3. Our own wheel/keydown listeners run whether or not Lenis exists yet,
//      and drive `progress` directly. SmoothScroll's own keydown→scrollTo
//      handler keeps firing on the same events, but scrollTo() is a
//      documented no-op while stopped (`if ((this.isStopped ||
//      this.isLocked) && !force) return;` in lenis.mjs) — no extra
//      coordination needed, it just harmlessly does nothing for the
//      duration of a lock.
//
// On release, the real scroll position is teleported (no animation) to
// exactly where the pinned frame would have naturally let go — so the very
// next native scroll event continues seamlessly into whatever comes next,
// instead of replaying 180vh of now-empty scroll distance.
//
// Escape hatches:
//   - Home/End are never intercepted (an explicit "jump", not a "step").
//   - Any key pressed while a real interactive element has focus is ignored
//     entirely (same focus guard as SmoothScroll's own handler).
//   - focusin outside the zone while locked (Tab moving past the last
//     focusable act CTA) immediately releases forward, so keyboard/screen
//     reader users are never trapped.
//
// Mobile and reduced-motion never mount this hook at all — see
// components/fx/JourneyScrub.jsx.

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, useScroll } from 'framer-motion';
import { useLenis } from '@/components/fx/SmoothScroll';

// Wheel/keyboard delta budget to fully traverse 0→1 — a deliberate pace,
// roughly "a few viewport-heights of input", not an instant flick.
const PROGRESS_RANGE_PX = 2400;

function keyScrollDelta(e) {
  switch (e.code) {
    case 'ArrowDown': return 160;
    case 'ArrowUp': return -160;
    case 'PageDown': return window.innerHeight * 0.9;
    case 'PageUp': return -window.innerHeight * 0.9;
    case 'Space': return window.innerHeight * 0.9;
    default: return null;
  }
}

export function useJourneyScrollLock({ trackRef, videoRef, enabled = true }) {
  const lenis = useLenis();
  const rawProgress = useMotionValue(0);
  const progress = useSpring(rawProgress, { stiffness: 260, damping: 32, mass: 0.5 });

  const lockedRef = useRef(false);
  const primedRef = useRef(false);
  // Hysteresis for re-entering the lock from below after having scrolled
  // past: must first move meaningfully away from the boundary before
  // arriving back at it counts as a fresh re-entry. Without this, releasing
  // forward (which lands scrollY exactly on the boundary) would immediately
  // look like "arrived at the boundary" again and re-lock in a loop.
  const armedRef = useRef(false);

  // Boundary sensor only — never drives the video directly. 'start start' /
  // 'end end' against the same tall track used before: 0 at the top edge,
  // 1 at the point the pinned frame would naturally release.
  const { scrollYProgress: boundarySensor } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });

  useEffect(() => {
    if (!enabled) return undefined;
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !track) return undefined;

    function measureBoundaries() {
      const rect = track.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const bottom = top + (rect.height - window.innerHeight);
      return { top, bottom };
    }

    let scrollbarPad = 0;
    function lockScroll(startProgress) {
      if (lockedRef.current) return;
      lockedRef.current = true;
      scrollbarPad = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      if (scrollbarPad > 0) document.documentElement.style.paddingRight = `${scrollbarPad}px`;
      lenis?.stop();
      rawProgress.set(startProgress);
    }

    function unlockScroll(landingY) {
      lockedRef.current = false;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.documentElement.style.paddingRight = '';
      if (lenis) {
        lenis.start();
        lenis.scrollTo(landingY, { immediate: true });
      } else {
        window.scrollTo(0, landingY);
      }
    }

    function releaseForward() {
      rawProgress.set(1);
      const { bottom } = measureBoundaries();
      unlockScroll(bottom);
    }

    function releaseBackward() {
      rawProgress.set(0);
      const { top } = measureBoundaries();
      unlockScroll(top);
    }

    function applyDelta(deltaPx) {
      const next = rawProgress.get() + deltaPx / PROGRESS_RANGE_PX;
      if (next >= 1) { releaseForward(); return; }
      if (next <= 0) { releaseBackward(); return; }
      rawProgress.set(next);
    }

    function onWheel(e) {
      if (!lockedRef.current) return;
      e.preventDefault();
      applyDelta(e.deltaY);
    }

    function onKeyDown(e) {
      if (!lockedRef.current) return;
      // Same rule as SmoothScroll's own handler: a focused interactive
      // element always wins, no exceptions.
      if (document.activeElement && document.activeElement !== document.body) return;
      const delta = keyScrollDelta(e);
      if (delta === null) return; // Home/End and everything else: untouched
      e.preventDefault();
      applyDelta(delta);
    }

    function onFocusIn(e) {
      if (!lockedRef.current) return;
      if (track.contains(e.target)) return; // still inside the zone — fine
      // Focus escaped the zone (Tab past the last CTA) — let the user out
      // instead of leaving them focused on something they can't see.
      releaseForward();
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('focusin', onFocusIn);

    // Prime the video once metadata is available — a silent play()+pause()
    // so the first seek isn't ignored for having nothing decoded yet.
    function prime() {
      if (primedRef.current) return;
      primedRef.current = true;
      const p = video.play();
      if (p && typeof p.then === 'function') p.then(() => video.pause()).catch(() => {});
      else video.pause();
    }
    if (video.readyState >= 1) prime();
    else video.addEventListener('loadedmetadata', prime, { once: true });

    // Drive currentTime from the smoothed value — a slightly settled scrub,
    // not a raw 1:1 jump per event.
    const unsubProgress = progress.on('change', (latest) => {
      if (!video.duration || Number.isNaN(video.duration)) return;
      video.currentTime = Math.min(Math.max(latest, 0), 1) * video.duration;
    });

    // Re-entry from below: only counts once the sensor has genuinely moved
    // away from 1 first (see armedRef comment above).
    const unsubBoundary = boundarySensor.on('change', (latest) => {
      if (lockedRef.current) return;
      if (latest < 0.95) armedRef.current = true;
      else if (latest >= 0.999 && armedRef.current) {
        armedRef.current = false;
        lockScroll(1);
      }
    });

    // Initial state: the acts zone is always the first thing on the page,
    // so a fresh load at the top means the user is already "in" the zone —
    // lock immediately. A reload/deep-link landing mid-scroll skips the
    // lock and just shows the journey as already completed.
    const { top } = measureBoundaries();
    if (window.scrollY <= top + 1) {
      lockScroll(0);
    } else {
      rawProgress.set(1);
    }

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('focusin', onFocusIn);
      video.removeEventListener('loadedmetadata', prime);
      unsubProgress();
      unsubBoundary();
      // Never leave the rest of the app scroll-locked if this unmounts
      // mid-lock (e.g. the user clicks a CTA and the view switches away).
      if (lockedRef.current) {
        lockedRef.current = false;
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.documentElement.style.paddingRight = '';
        lenis?.start();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return progress;
}
