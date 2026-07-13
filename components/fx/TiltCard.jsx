'use client';

import { useRef } from 'react';
import { motion, useSpring, useReducedMotion } from 'framer-motion';

// Subtle 3D tilt with spring physics — gives cards a physical, material feel.
export default function TiltCard({ children, className = '', max = 5, ...props }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const spring = { stiffness: 180, damping: 20, mass: 0.8 };
  const rx = useSpring(0, spring);
  const ry = useSpring(0, spring);

  function onMove(e) {
    if (reduce || !ref.current || e.pointerType === 'touch') return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * max);
    rx.set(-py * max);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
