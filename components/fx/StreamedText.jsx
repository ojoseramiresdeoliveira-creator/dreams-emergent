'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Streaming-style reveal: words surface in reading order, capped so long
// replies never take more than ~2s to fully appear. Plain text under
// reduced motion.
export default function StreamedText({ text, className = '' }) {
  const reduce = useReducedMotion();
  const words = useMemo(() => String(text).split(/(\s+)/), [text]);
  if (reduce) return <span className={className}>{text}</span>;
  const n = words.filter((w) => w.trim()).length || 1;
  const stagger = Math.min(0.035, 1.8 / n);
  let wi = 0;
  return (
    <span className={className}>
      {words.map((w, i) => {
        if (!w.trim()) return <span key={i}>{w}</span>;
        const delay = wi++ * stagger;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay, ease: 'easeOut' }}
            className="inline-block"
          >
            {w}
          </motion.span>
        );
      })}
    </span>
  );
}
