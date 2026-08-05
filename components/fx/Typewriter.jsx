'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

// Char-by-char reveal for a single emotionally-weighted line (the Guardian
// quote on the landing): the words arrive slowly, like they're being chosen,
// not typed efficiently. Longer pauses land after sentence-ending punctuation
// (. :) so the rhythm reads as thought. `startDelay` lets the caller hold the
// first character until a parent entrance animation (e.g. the card's fade-up)
// has finished, so the two never race.
//
// Fires once per browser tab session — sessionStorage[sessionKey] gates it,
// so scrolling past the block again in the same session shows the full line
// immediately, with no retyping and no caret. Reduced motion skips the effect
// entirely and renders the full line straight away.
export default function Typewriter({ text, sessionKey, startDelay = 0, className = '' }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [display, setDisplay] = useState('');
  const [cursorOn, setCursorOn] = useState(false);

  useEffect(() => {
    if (reduce || !inView || typeof window === 'undefined') return;
    if (sessionStorage.getItem(sessionKey) === '1') {
      setDisplay(text);
      return;
    }

    let cancelled = false;
    let stepTimer;
    let i = 0;

    function step() {
      if (cancelled) return;
      i += 1;
      setDisplay(text.slice(0, i));
      if (i >= text.length) {
        setCursorOn(false);
        sessionStorage.setItem(sessionKey, '1');
        return;
      }
      // Base cadence is deliberately unhurried (45-55ms/char); a sentence-
      // ending character earns a longer breath (400-600ms) before the next
      // one starts, like the Guardian is picking its next words.
      const justTyped = text[i - 1];
      const pause = /[.:]/.test(justTyped) ? 400 + Math.random() * 200 : 45 + Math.random() * 10;
      stepTimer = setTimeout(step, pause);
    }

    const startTimer = setTimeout(() => { setCursorOn(true); step(); }, startDelay);
    return () => { cancelled = true; clearTimeout(startTimer); clearTimeout(stepTimer); };
  }, [reduce, inView, text, sessionKey, startDelay]);

  if (reduce) return <span ref={ref} className={className}>{text}</span>;

  return (
    <span ref={ref} className={className}>
      {display}
      {cursorOn && <span aria-hidden className="typewriter-caret" />}
    </span>
  );
}
