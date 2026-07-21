'use client';

// Smooth-scroll spine for the trailer. Wraps a subtree in a Lenis instance and
// wires it to GSAP's ScrollTrigger so scroll-scrubbed timelines (the 5 acts'
// video layers) read a single, inertia-smoothed scroll position.
//
// Decorative by contract: under prefers-reduced-motion this component does
// NOTHING — it renders children untouched and lets the browser scroll natively.
// ScrollTrigger still works on native scroll, so any scrub that depends on it
// simply runs without the inertia. No copy is ever gated on this mounting.

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function SmoothScroll({ children }) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // native scroll — nothing to set up, nothing to tear down

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      // gentle inertia — long enough to feel cinematic, short enough to stay responsive
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
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

    return () => {
      lenis.off('scroll', ScrollTrigger.update);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return children;
}
