// Central motion vocabulary — every animated surface shares this language.
// Mirrors the CSS tokens in app/globals.css (--ease-out, --dur-*).

export const EASE = [0.16, 1, 0.3, 1]; // premium ease-out
export const EASE_IN_OUT = [0.65, 0, 0.35, 1];

export const DUR = {
  fast: 0.2,
  base: 0.4,
  slow: 0.7,
  slower: 1.2,
};

// Spring presets — physical feel without wobble.
export const SPRING = { type: 'spring', stiffness: 260, damping: 24, mass: 0.9 };
export const SPRING_SOFT = { type: 'spring', stiffness: 170, damping: 22, mass: 1 };
export const SPRING_SNAPPY = { type: 'spring', stiffness: 380, damping: 26, mass: 0.6 };

export const VIEWPORT = { once: true, margin: '-80px' };

export const fadeUp = (delay = 0, y = 24) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease: EASE },
});

export const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 1.2, delay, ease: EASE },
});

// Parent/child pair for staggered card grids and lists.
export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export const staggerChild = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};
