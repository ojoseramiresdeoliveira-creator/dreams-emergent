'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';

// Champagne dust for the instant a stone settles into the Monument: a
// handful of motes lift from the point of impact (biased upward, like dust
// kicked off a landing), plus a faint expanding ring. One-shot,
// transform/opacity only. Renders nothing under reduced motion.
export default function SettleDust({ count = 12 }) {
  const reduce = useReducedMotion();
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 18 + Math.random() * 34;
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.7 - 8, // dust lifts, it doesn't sink
          r: 1.2 + Math.random() * 1.8,
          d: 0.6 + Math.random() * 0.5,
          delay: Math.random() * 0.12,
        };
      }),
    [count]
  );
  if (reduce) return null;
  return (
    <span aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <motion.span
        initial={{ opacity: 0.5, scale: 0.4 }}
        animate={{ opacity: 0, scale: 1.9 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="absolute w-8 h-8 rounded-full border border-champagne/50"
      />
      {parts.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
          transition={{ duration: p.d, delay: p.delay, ease: EASE }}
          className="absolute rounded-full bg-champagne"
          style={{ width: p.r, height: p.r }}
        />
      ))}
    </span>
  );
}
