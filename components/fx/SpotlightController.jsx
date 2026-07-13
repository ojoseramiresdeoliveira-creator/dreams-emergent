'use client';

import { useEffect } from 'react';

// One document-level pointer listener drives the cursor-following light on
// every element carrying the `.spotlight` class (see globals.css). Mount once.
export default function SpotlightController() {
  useEffect(() => {
    const onMove = (e) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest('.spotlight');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);
  return null;
}
