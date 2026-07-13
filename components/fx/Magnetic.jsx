'use client';

import { useRef } from 'react';
import { motion, useSpring, useReducedMotion } from 'framer-motion';

// Magnetic attraction for primary CTAs: the element leans toward the cursor
// and springs back to rest on leave.
export default function Magnetic({ children, strength = 0.22, className = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const spring = { stiffness: 200, damping: 18, mass: 0.5 };
  const x = useSpring(0, spring);
  const y = useSpring(0, spring);

  function onMove(e) {
    if (reduce || !ref.current || e.pointerType === 'touch') return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ x, y }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
}
