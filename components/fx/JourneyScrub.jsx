'use client';

// The 5-act trailer, now a single clip instead of five (act01–05). Desktop
// scrubs it against scroll inside a pinned track; mobile plays it as a
// natural muted loop (the same useAutoplayInView contract every act already
// used) with the five chapters stacked in normal flow. Reduced motion skips
// both and shows a static poster with the chapters stacked underneath.
//
// Desktop scroll-scrub was tried once before on this exact landing and
// removed for stuttering (see lib/useScrollScrubVideo.js's header) — mobile
// deliberately does NOT attempt currentTime scrubbing at all (iOS Safari seek
// is unreliable), it reuses the loop-in-view mechanism proven by every act
// video today.
//
// The old per-act ScrubScene machinery and act01–05 assets are untouched and
// unreferenced here — see components/fx/ScrubScene.jsx — kept as a rollback
// path until this is confirmed in production.

import { useRef } from 'react';
import { motion, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Magnetic from './Magnetic';
import LineReveal from './LineReveal';
import { useScrollScrubVideo } from '@/lib/useScrollScrubVideo';
import { useAutoplayInView } from '@/lib/useAutoplayInView';
import { videoSrc } from '@/lib/videoSrc';
import { EASE } from '@/lib/motion';

// Trapped-scroll history on this landing: 320vh → 220vh → removed entirely.
// 280vh sits between those two — enough scroll distance for 5 chapters to
// each get a real beat, without reopening the "dead scroll" complaint that
// preceded the removal.
const TRACK_VH = 280;

const ACTS = [
  {
    headline: ['Every dream deserves', <span key="l2" className="italic text-champagne">a monument.</span>],
    cta: 'Lay the first stone',
  },
  {
    headline: <>The world remembers the arrival. We remember <span className="italic text-champagne">the climb.</span></>,
    cta: 'Begin your record',
  },
  {
    headline: <>Every step no one saw is still <span className="italic text-champagne">a step you took.</span></>,
    cta: 'Inscribe what they missed',
  },
  {
    headline: <>This is what a life looks like when nothing is <span className="italic text-champagne">forgotten.</span></>,
    cta: 'Build what endures',
  },
  {
    headline: <>The first stone <span className="italic text-champagne">won&rsquo;t lay itself.</span></>,
    cta: 'Raise my Monument',
  },
];

function ActCTA({ act, index, onBegin }) {
  // Restrained on purpose, matching the rest of the landing's CTA grammar:
  // Magnetic + the solid surface are reserved for the two bookend moments
  // (first and last act); the three chapters in between stay on the quieter
  // outline surface, same hierarchy the old hero/finale pair already set.
  const isBookend = index === 0 || index === ACTS.length - 1;
  const button = (
    <button
      onClick={onBegin}
      className={
        isBookend
          ? 'btn-premium btn-solid sheen group px-12 py-5 rounded-full text-[11px] tracking-[0.24em] uppercase font-medium inline-flex items-center gap-3'
          : 'btn-premium btn-outline group px-10 py-4 rounded-full text-[11px] tracking-[0.24em] uppercase inline-flex items-center gap-3'
      }
    >
      {act.cta}
      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-500" />
    </button>
  );
  return isBookend ? <Magnetic className="mt-12">{button}</Magnetic> : <div className="mt-12">{button}</div>;
}

function ActHeadline({ act, index, sizeClass }) {
  if (index === 0) {
    // Only the arrival gets the masked line-rise the old hero used — the
    // other four read as chapters of one continuous take, not four more
    // "openings".
    return (
      <h1 className={`font-serif font-display ${sizeClass} leading-[1.02] track-display text-platinum max-w-3xl`}>
        <LineReveal mode="mount" delay={0.5} lines={act.headline} />
      </h1>
    );
  }
  return (
    <h2 className={`font-serif font-display ${sizeClass} leading-[1.05] track-title text-platinum max-w-3xl`}>
      {act.headline}
    </h2>
  );
}

// Desktop: one absolutely-positioned block per act, cross-fading in and out
// of a shared shared window of the scrub progress it owns (1/5th each).
function DesktopActBlock({ act, index, progress, onBegin }) {
  const count = ACTS.length;
  const start = index / count;
  const end = (index + 1) / count;
  const ramp = (end - start) * 0.15;
  const fadeInEnd = start + ramp;
  const fadeOutStart = end - ramp;
  const isFirst = index === 0;

  const opacity = useTransform(
    progress,
    [start, fadeInEnd, fadeOutStart, end],
    [isFirst ? 1 : 0, 1, 1, 0]
  );
  const y = useTransform(progress, [start, fadeInEnd], [isFirst ? 0 : 16, 0]);
  // Only the currently-visible block should be clickable — an opacity-0
  // sibling still intercepts clicks unless pointer-events is turned off too.
  const pointerEvents = useTransform(
    progress,
    [start, fadeInEnd, fadeOutStart, end],
    [isFirst ? 'auto' : 'none', 'auto', 'auto', 'none']
  );

  return (
    <motion.div
      style={{ opacity, y, pointerEvents }}
      className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
    >
      <ActHeadline act={act} index={index} sizeClass="text-[clamp(30px,4.4vw,68px)]" />
      <ActCTA act={act} index={index} onBegin={onBegin} />
    </motion.div>
  );
}

function JourneyScrubDesktop({ onBegin }) {
  const trackRef = useRef(null);
  const videoRef = useRef(null);
  const progress = useScrollScrubVideo({ trackRef, videoRef, enabled: true });

  return (
    <div ref={trackRef} className="relative" style={{ height: `${TRACK_VH}vh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <video
          ref={videoRef}
          aria-hidden
          muted
          playsInline
          preload="auto"
          poster="/videos/journey-poster.jpg"
          className="clip-melt brightness-105 absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src={videoSrc('/videos/journey.mp4')} type="video/mp4" />
        </video>
        <div aria-hidden className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/25 via-black/8 to-black/30" />
        {ACTS.map((act, i) => (
          <DesktopActBlock key={i} act={act} index={i} progress={progress} onBegin={onBegin} />
        ))}
      </div>
    </div>
  );
}

function JourneyScrubMobile({ onBegin }) {
  const reduce = useReducedMotion();
  const videoRef = useRef(null);
  useAutoplayInView({ videoRef, enabled: !reduce });

  return (
    <div className="relative bg-black">
      <section className="overflow-hidden flex items-center justify-center bg-black relative min-h-[100svh]">
        <video
          ref={videoRef}
          aria-hidden
          muted
          playsInline
          preload="none"
          poster="/videos/journey-mobile-poster.jpg"
          className="clip-melt brightness-105 absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src={videoSrc('/videos/journey-mobile.mp4')} type="video/mp4" />
        </video>
        <div aria-hidden className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/25 via-black/8 to-black/30" />
        <div className="relative w-full max-w-[560px] mx-auto px-6 py-28 flex flex-col items-center text-center gap-24">
          {ACTS.map((act, i) => (
            <motion.div
              key={i}
              initial={i === 0 ? undefined : { opacity: 0, y: 20 }}
              whileInView={i === 0 ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 1.2, ease: EASE }}
              className="w-full flex flex-col items-center"
            >
              <ActHeadline act={act} index={i} sizeClass="text-[clamp(28px,7vw,44px)]" />
              <ActCTA act={act} index={i} onBegin={onBegin} />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Reduced motion: no video at all, just the desktop poster as a static
// backdrop with the five chapters stacked underneath — same contract every
// other section on this landing already gives reduced-motion visitors.
function JourneyReduced({ onBegin }) {
  return (
    <section
      className="relative bg-black bg-cover bg-center"
      style={{ backgroundImage: "url('/videos/journey-poster.jpg')" }}
    >
      <div aria-hidden className="absolute inset-0 bg-black/45" />
      <div className="relative max-w-[720px] mx-auto px-6 py-28 flex flex-col items-center text-center gap-20">
        {ACTS.map((act, i) => (
          <div key={i} className="w-full flex flex-col items-center">
            <ActHeadline act={act} index={i} sizeClass="text-[clamp(28px,6vw,56px)]" />
            <ActCTA act={act} index={i} onBegin={onBegin} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function JourneyScrub({ id, onBegin }) {
  const reduce = useReducedMotion();
  if (reduce) return <div id={id}><JourneyReduced onBegin={onBegin} /></div>;
  return (
    <div id={id}>
      <div className="hidden md:block">
        <JourneyScrubDesktop onBegin={onBegin} />
      </div>
      <div className="md:hidden">
        <JourneyScrubMobile onBegin={onBegin} />
      </div>
    </div>
  );
}
