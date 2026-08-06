'use client';

// Smooth-scroll spine for the trailer. Wraps a subtree in a Lenis instance and
// wires it to GSAP's ScrollTrigger so scroll-scrubbed timelines (the 5 acts'
// video layers) read a single, inertia-smoothed scroll position.
//
// Lenis only ever listens to wheel and touch (confirmed against its own
// types — there is no keyboard option). Left alone, ArrowUp/Down, PageUp/
// Down and Space fall through to the browser's native, un-damped scroll-by,
// which covers the 5-act pinned track (280vh) in a couple of keypresses
// instead of the many gentle wheel notches it takes via Lenis — reads as
// "scrolled straight past the acts" even though the pin itself never broke.
// The keydown handler below routes exactly those keys through the same
// lenis.scrollTo() wheel scroll already uses, so keyboard users get the same
// paced traversal. Home/End are deliberately left native (an explicit
// "jump to start/end" request, not a "step through" gesture) — and any key
// pressed while a real interactive element has focus (an input, a button,
// anything other than <body>) is left alone entirely, so typing a space or
// moving a text cursor is never intercepted.
//
// Decorative by contract: under prefers-reduced-motion this component does
// NOTHING — it renders children untouched and lets the browser scroll natively.
// ScrollTrigger still works on native scroll, so any scrub that depends on it
// simply runs without the inertia. No copy is ever gated on this mounting.
//
// Exposes the live Lenis instance via context (useLenis()) so a descendant —
// today, the journey scroll-lock hook — can call lenis.stop()/start() to
// coordinate a true scroll hijack instead of fighting it. scrollTo() is a
// documented no-op while stopped (lenis.mjs: `if ((this.isStopped ||
// this.isLocked) && !force) return;`), so this component's own keydown→
// scrollTo handler above harmlessly no-ops for the duration of a lock — no
// extra coordination needed there.

import { createContext, useContext, useEffect, useState } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const LenisContext = createContext(null);

// Returns the live Lenis instance, or null before it's ready / under
// reduced motion / outside a <SmoothScroll>. Callers must handle null.
export function useLenis() {
  return useContext(LenisContext);
}

// Same curve for every input method — wheel (via the Lenis constructor) and
// keyboard (via the scrollTo() calls below) should feel identical.
const LENIS_DURATION = 1.1;
const LENIS_EASING = (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

// Maps a keyboard event to a scroll delta in px, or null if this key isn't
// one we take over. Arrow keys nudge like a single wheel notch; Page/Space
// jump roughly a viewport, matching native Page Down behaviour.
function keyScrollDelta(e) {
  switch (e.code) {
    case 'ArrowDown': return 120;
    case 'ArrowUp': return -120;
    case 'PageDown': return window.innerHeight * 0.9;
    case 'PageUp': return -window.innerHeight * 0.9;
    case 'Space': return window.innerHeight * 0.9;
    default: return null;
  }
}

export default function SmoothScroll({ children }) {
  const [lenisInstance, setLenisInstance] = useState(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // native scroll — nothing to set up, nothing to tear down

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      // gentle inertia — long enough to feel cinematic, short enough to stay responsive
      duration: LENIS_DURATION,
      easing: LENIS_EASING,
      smoothWheel: true,
      // touch keeps native behaviour: scrubbing video on mobile is handled
      // (and usually disabled) at the hook level, not here.
      syncTouch: false,
    });

    // Every Lenis frame is a chance for ScrollTrigger to re-evaluate.
    lenis.on('scroll', ScrollTrigger.update);

    // Drive Lenis from GSAP's ticker so there is a single rAF loop on the page.
    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    function onKeyDown(e) {
      // Only take over when nothing else has focus — the instant any
      // interactive element (input, button, link…) is focused, its own
      // native key handling should win, no exceptions.
      if (document.activeElement && document.activeElement !== document.body) return;
      const delta = keyScrollDelta(e);
      if (delta === null) return;
      e.preventDefault();
      // targetScroll (not animatedScroll) so repeated presses accumulate
      // correctly instead of each one restarting from the still-animating,
      // not-yet-arrived visual position.
      lenis.scrollTo(lenis.targetScroll + delta, { duration: LENIS_DURATION, easing: LENIS_EASING });
    }
    window.addEventListener('keydown', onKeyDown);
    setLenisInstance(lenis);

    return () => {
      setLenisInstance(null);
      lenis.off('scroll', ScrollTrigger.update);
      gsap.ticker.remove(raf);
      window.removeEventListener('keydown', onKeyDown);
      lenis.destroy();
    };
  }, []);

  return <LenisContext.Provider value={lenisInstance}>{children}</LenisContext.Provider>;
}
