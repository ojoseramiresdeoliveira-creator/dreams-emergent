'use client';

// GSAP SplitText equivalent of LineReveal.jsx — same "lines rise out of a
// mask" effect, but split at runtime off the actual rendered layout (SplitText
// type:'lines', mask:'lines') instead of a manually pre-split `lines` array.
// That makes it correct across reflow/breakpoints for free, and is the same
// primitive the reference site's headline reveals use.
//
// API differs from LineReveal on purpose: takes `children` (the real heading
// markup, inline spans and all) instead of a pre-split `lines` array, because
// SplitText needs the rendered text node to split.
//
// Decorative by contract: under prefers-reduced-motion this renders children
// untouched — no split, no ScrollTrigger, no copy gated on it.

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import { GSAP_EASE } from '@/lib/useScrollReveal';
import { EASE } from '@/lib/motion';

let setupDone = false;
function ensureGsapSetup() {
  if (setupDone) return;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  if (!CustomEase.get(GSAP_EASE)) CustomEase.create(GSAP_EASE, EASE.join(','));
  setupDone = true;
}

// SSR renders full unsplit text (React warns if useLayoutEffect runs on the
// server); on the client it must run *before* paint so the split+mask never
// flashes the plain, unanimated heading first.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : () => {};

export default function SplitReveal({
  children,
  as: Tag = 'span',
  className = '',
  delay = 0,
  stagger = 0.14,
  duration = 1.2,
  mode = 'view', // 'view' animates once on scroll-into-view; 'mount' animates on first render
}) {
  const ref = useRef(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // leave children exactly as rendered — no split, no motion

    ensureGsapSetup();

    let split;
    let trigger;
    const ctx = gsap.context(() => {
      split = SplitText.create(el, { type: 'lines', mask: 'lines', autoSplit: true });
      gsap.set(split.lines, { yPercent: 112 });

      const tween = gsap.to(split.lines, {
        yPercent: 0,
        duration,
        delay,
        stagger,
        ease: GSAP_EASE,
        paused: mode === 'view',
      });

      if (mode === 'view') {
        trigger = ScrollTrigger.create({
          trigger: el,
          start: 'top 80%',
          once: true,
          onEnter: () => tween.play(),
        });
      }
    });

    return () => {
      trigger?.kill();
      split?.revert();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
