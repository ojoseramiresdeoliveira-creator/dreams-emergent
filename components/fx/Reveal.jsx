'use client';

import { motion } from 'framer-motion';
import { EASE, VIEWPORT } from '@/lib/motion';

// Standard scroll-reveal: fades and rises once when the element enters view.
export default function Reveal({ children, delay = 0, y = 24, duration = 0.9, className = '', ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration, delay, ease: EASE }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
