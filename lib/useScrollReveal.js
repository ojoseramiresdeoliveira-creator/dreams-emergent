'use client';

// GSAP/ScrollTrigger equivalent of the Framer Motion fadeUp/staggerChild
// tokens in lib/motion.js — for content blocks that aren't headline text
// (SplitReveal.jsx handles those). Fires once, on enter, never pins or
// scrubs: gsap.fromTo() + ScrollTrigger.create({ once: true }), same
// contract as the reference this mirrors.
//
// Decorative by contract: under prefers-reduced-motion this sets the final
// state immediately and never registers a ScrollTrigger — no copy or layout
// is ever gated on it.

import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import { EASE } from '@/lib/motion';

let easeRegistered = false;
// Same curve as Framer Motion's EASE, expressed as a GSAP CustomEase, so
// GSAP-driven and Framer-Motion-driven sections still read as one family.
export const GSAP_EASE = 'premiumOut';

function ensureGsapSetup() {
  if (easeRegistered) return;
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  CustomEase.create(GSAP_EASE, EASE.join(','));
  easeRegistered = true;
}

// Runs before paint (see SplitReveal.jsx for why) so the initial opacity:0
// is what the browser paints first, never a flash of the settled content.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : () => {};

// ref: element (or group parent) to reveal.
// childSelector: if set, animates ref.current's matching children individually
// (with `stagger`) instead of the element itself — for card grids/lists.
export function useScrollReveal(ref, {
  y = 24,
  duration = 0.9,
  delay = 0,
  stagger = 0,
  childSelector = null,
  start = 'top 80%',
} = {}) {
  useIsoLayoutEffect(() => {
    const el = ref?.current;
    if (!el) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = childSelector ? el.querySelectorAll(childSelector) : el;
    if (reduce) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    ensureGsapSetup();

    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration,
        delay,
        stagger,
        ease: GSAP_EASE,
        scrollTrigger: { trigger: el, start, once: true },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
