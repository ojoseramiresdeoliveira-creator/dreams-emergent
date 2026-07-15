'use client';

import { useId } from 'react';
import { motion, useReducedMotion, useMotionValue, useTransform } from 'framer-motion';
import { EASE } from '@/lib/motion';

/* The Monument — seven stones stacked into a cairn. Pure SVG with flat
   gradients so it costs nothing to multiply dozens of times (the Community
   act). Its silhouette IS the product story: every Stone the user lays is a
   stone of the monument.

   Three modes:
   - `reveal` (hero, default): light rises from base to peak once, then a
     champagne glow settles and breathes forever.
   - `progress` (a scroll MotionValue): the monument ASSEMBLES stone by stone,
     bottom → top, as progress goes 0 → 1 — the growth act.
   - `reveal={false}` / reduced motion: fully lit, static frame. */

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

// One stone rising into place as the scroll crosses its band (base first).
function AssemblingStone({ p, i, total, s, fill }) {
  const from = (i / total) * 0.72;
  const opacity = useTransform(p, [from, from + 0.05], [0, 1]);
  const y = useTransform(p, [from, from + 0.14], [18, 0]);
  const x = CX + s.dx - s.w / 2;
  return (
    <motion.g style={{ opacity, y }}>
      <rect x={x} y={s.y} width={s.w} height={s.h} rx="3" fill={fill} />
      <rect x={x} y={s.y} width={s.w} height="1.6" rx="0.8" fill="rgba(212,176,106,0.35)" />
    </motion.g>
  );
}

export default function Monument({ className = '', style, reveal = true, progress }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const id = (k) => `${uid}-${k}`;
  const assembling = !!progress && !reduce;
  const lit = reduce || !reveal; // fully-lit static (used only in reveal mode)

  // A stable fallback so the transform hooks below are always called with a
  // real MotionValue, even in the hero (no-progress) path.
  const fallback = useMotionValue(0);
  const prog = progress ?? fallback;
  const assembledGlow = useTransform(prog, [0.72, 1], [0, 0.5]);

  return (
    <svg viewBox="0 0 240 380" className={className} style={style} aria-hidden fill="none">
      <defs>
        <linearGradient id={id('stone')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2824" />
          <stop offset="1" stopColor="#131110" />
        </linearGradient>
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
        <linearGradient id={id('fog')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(10,10,11,0)" />
          <stop offset="0.55" stopColor="rgba(10,10,11,0.65)" />
          <stop offset="1" stopColor="rgba(10,10,11,1)" />
        </linearGradient>

        {/* stones defined once — reused as visible fill and clip silhouette */}
        <g id={id('stones')}>
          {STONES.map((s, i) => {
            const x = CX + s.dx - s.w / 2;
            return (
              <g key={i}>
                <rect x={x} y={s.y} width={s.w} height={s.h} rx="3" fill={`url(#${id('stone')})`} />
                <rect x={x} y={s.y} width={s.w} height="1.6" rx="0.8" fill="rgba(212,176,106,0.35)" />
              </g>
            );
          })}
        </g>

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

      {/* glow at the peak — breathes (hero) or fades in as it assembles (growth) */}
      {assembling ? (
        <motion.g style={{ opacity: assembledGlow, mixBlendMode: 'screen' }}>
          <circle cx="120" cy="96" r="100" fill={`url(#${id('glow')})`} />
        </motion.g>
      ) : (
        <motion.g
          initial={lit ? false : { opacity: 0 }}
          animate={lit ? { opacity: 0.42 } : { opacity: [0.3, 0.55, 0.3] }}
          transition={lit ? { duration: 1 } : { duration: 7, delay: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ mixBlendMode: 'screen' }}
        >
          <circle cx="120" cy="96" r="100" fill={`url(#${id('glow')})`} />
        </motion.g>
      )}

      {/* the stones */}
      {assembling ? (
        <g>
          {STONES.map((s, i) => (
            <AssemblingStone key={i} p={prog} i={i} total={STONES.length} s={s} fill={`url(#${id('stone')})`} />
          ))}
        </g>
      ) : (
        <>
          <g clipPath={`url(#${id('reveal')})`}>
            <use href={`#${id('stones')}`} />
          </g>
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
        </>
      )}

      {/* fog swallows the base */}
      <rect x="0" y="286" width="240" height="94" fill={`url(#${id('fog')})`} />
    </svg>
  );
}
