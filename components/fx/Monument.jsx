'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';

/* The Monument — seven stones stacked into a cairn. Pure SVG with flat
   gradients so it costs nothing to multiply dozens of times (the Community
   act). Its silhouette IS the product story: every Stone the user lays is a
   stone of the monument, which is what lets a later act grow it, one stone at
   a time.

   `reveal` (hero, default): light rises from the base to the peak once, then
   settles into a champagne glow that breathes forever. `reveal={false}`
   renders it fully lit and static — for distant instances in the Community.
   Renders a still, fully-lit frame under reduced motion. */

// Bottom → top. Base widest, narrowing to the peak; small alternating offsets
// keep the stack hand-laid rather than machined.
const STONES = [
  { y: 298, w: 150, h: 32, dx: 0 },
  { y: 261, w: 134, h: 31, dx: -3 },
  { y: 225, w: 118, h: 30, dx: 3 },
  { y: 190, w: 102, h: 29, dx: -2 },
  { y: 156, w: 86, h: 28, dx: 2 },
  { y: 123, w: 70, h: 27, dx: -2 },
  { y: 91, w: 56, h: 26, dx: 0 },
];
const CX = 120;

export default function Monument({ className = '', style, reveal = true }) {
  const reduce = useReducedMotion();
  // Namespaced ids so many Monuments can share a page without collisions.
  const uid = useId().replace(/:/g, '');
  const id = (k) => `${uid}-${k}`;
  const lit = reduce || !reveal;

  return (
    <svg viewBox="0 0 240 380" className={className} style={style} aria-hidden fill="none">
      <defs>
        {/* Flat vertical stone: lit top ledge, shadowed base — reads the stack. */}
        <linearGradient id={id('stone')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2824" />
          <stop offset="1" stopColor="#131110" />
        </linearGradient>
        {/* Champagne band that travels up the face during the reveal. */}
        <linearGradient id={id('band')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(232,200,138,0)" />
          <stop offset="0.5" stopColor="rgba(232,200,138,0.55)" />
          <stop offset="1" stopColor="rgba(232,200,138,0)" />
        </linearGradient>
        <radialGradient id={id('glow')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(224,196,138,0.5)" />
          <stop offset="0.5" stopColor="rgba(212,176,106,0.14)" />
          <stop offset="1" stopColor="rgba(212,176,106,0)" />
        </radialGradient>
        <radialGradient id={id('haze')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(212,176,106,0.10)" />
          <stop offset="1" stopColor="rgba(212,176,106,0)" />
        </radialGradient>
        {/* Fog: the base dissolves into obsidian — no line where the ground is. */}
        <linearGradient id={id('fog')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(10,10,11,0)" />
          <stop offset="0.55" stopColor="rgba(10,10,11,0.65)" />
          <stop offset="1" stopColor="rgba(10,10,11,1)" />
        </linearGradient>

        {/* The stones, defined once — reused as the visible fill and as the
            clip silhouette for the rising light band. */}
        <g id={id('stones')}>
          {STONES.map((s, i) => {
            const x = CX + s.dx - s.w / 2;
            return (
              <g key={i}>
                <rect x={x} y={s.y} width={s.w} height={s.h} rx="3" fill={`url(#${id('stone')})`} />
                {/* champagne catchlight on the top ledge — engraved detail */}
                <rect x={x} y={s.y} width={s.w} height="1.6" rx="0.8" fill="rgba(212,176,106,0.35)" />
              </g>
            );
          })}
        </g>

        {/* Reveal window — grows upward from the base, once. */}
        <clipPath id={id('reveal')}>
          {lit ? (
            <rect x="0" y="84" width="240" height="250" />
          ) : (
            <motion.rect
              x="0"
              y="84"
              width="240"
              height="250"
              style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 2.4, delay: 0.5, ease: EASE }}
            />
          )}
        </clipPath>
        <clipPath id={id('silhouette')}>
          <use href={`#${id('stones')}`} />
        </clipPath>
      </defs>

      {/* champagne haze pooling at the base — volumetric floor light */}
      <ellipse cx="120" cy="316" rx="128" ry="34" fill={`url(#${id('haze')})`} style={{ mixBlendMode: 'screen' }} />

      {/* glow at the peak: fades in after the reveal, then breathes forever */}
      <motion.g
        initial={lit ? false : { opacity: 0 }}
        animate={lit ? { opacity: 0.42 } : { opacity: [0.3, 0.55, 0.3] }}
        transition={lit ? { duration: 1 } : { duration: 7, delay: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ mixBlendMode: 'screen' }}
      >
        <circle cx="120" cy="96" r="100" fill={`url(#${id('glow')})`} />
      </motion.g>

      {/* the stones, revealed */}
      <g clipPath={`url(#${id('reveal')})`}>
        <use href={`#${id('stones')}`} />
      </g>

      {/* light travelling up the face, clipped to the silhouette */}
      {!lit && (
        <g clipPath={`url(#${id('silhouette')})`} style={{ mixBlendMode: 'screen' }}>
          <motion.rect
            x="0"
            width="240"
            height="54"
            fill={`url(#${id('band')})`}
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: [300, 180, 60], opacity: [0, 0.9, 0] }}
            transition={{ duration: 2.2, delay: 0.5, ease: EASE, times: [0, 0.5, 1] }}
          />
        </g>
      )}

      {/* fog swallows the base */}
      <rect x="0" y="286" width="240" height="94" fill={`url(#${id('fog')})`} />
    </svg>
  );
}
