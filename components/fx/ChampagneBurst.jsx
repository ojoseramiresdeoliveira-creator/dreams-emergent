'use client';

import { useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';

// Restrained champagne particle burst for the moment the Monument is raised:
// a soft expanding ring + ~26 gold motes radiating and fading. Calls
// onComplete when the ceremony ends (immediately under reduced motion).
export default function ChampagneBurst({ onComplete, duration = 1.6 }) {
  const reduce = useReducedMotion();
  const parts = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const angle = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 90 + Math.random() * 150;
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          r: 2 + Math.random() * 3,
          d: 0.9 + Math.random() * 0.6,
        };
      }),
    []
  );

  useEffect(() => {
    const t = setTimeout(onComplete, reduce ? 150 : duration * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduce) return null;

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0.55, scale: 0.35 }}
        animate={{ opacity: 0, scale: 1.7 }}
        transition={{ duration: 1.1, ease: EASE }}
        className="absolute w-44 h-44 rounded-full border border-champagne/40"
      />
      {parts.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: p.d, ease: EASE }}
          className="absolute rounded-full bg-champagne"
          style={{ width: p.r, height: p.r }}
        />
      ))}
    </div>
  );
}
