'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';

// Cinematic masked line reveal for serif headlines: each line rises out of an
// overflow-hidden mask with a soft stagger. `mode="mount"` animates on first
// render (hero); default `mode="view"` animates once when scrolled into view.
export default function LineReveal({
  lines,
  className = '',
  delay = 0,
  stagger = 0.14,
  duration = 1.2,
  mode = 'view',
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <span className={className}>
        {lines.map((line, i) => (
          <span key={i} className="block">{line}</span>
        ))}
      </span>
    );
  }

  const anim = (i) => ({
    initial: { y: '112%' },
    ...(mode === 'mount'
      ? { animate: { y: '0%' } }
      : { whileInView: { y: '0%' }, viewport: { once: true, margin: '-100px' } }),
    transition: { duration, delay: delay + i * stagger, ease: EASE },
  });

  return (
    <span className={className}>
      {lines.map((line, i) => (
        // pb/-mb keep serif descenders (g, y, italic swashes) inside the mask
        <span key={i} className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
          <motion.span className="block will-change-transform" {...anim(i)}>
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
