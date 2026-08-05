'use client';

// The 5-act trailer, now a single clip instead of five (act01–05). Desktop
// scrubs it against scroll inside a pinned track; mobile plays it as a
// natural muted loop (the same useAutoplayInView contract every act already
// used), pinned behind five dedicated full-screen chapters. Reduced motion
// skips both and shows a static poster with the chapters stacked underneath.
//
// Visual language: full-bleed edge-to-edge video (no melt mask, no frame),
// large editorial serif type anchored bottom-left, a small "Act N" kicker
// top-left — same corner every act, so it reads as one continuous take with
// changing captions, not five separate cards.
//
// Desktop scroll-scrub was tried once before on this exact landing and
// removed for stuttering (see lib/useScrollScrubVideo.js's header) — mobile
// deliberately does NOT attempt currentTime scrubbing at all (iOS Safari seek
// is unreliable), it reuses the loop-in-view mechanism proven by every act
// video today.
//
// The old per-act ScrubScene machinery and act01–05 assets (including
// .clip-melt) are untouched and unreferenced here — see
// components/fx/ScrubScene.jsx — kept as a rollback path until this is
// confirmed in production.

import { useRef } from 'react';
import { motion, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
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

const ACT_ORDINALS = ['One', 'Two', 'Three', 'Four', 'Five'];

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

// Same edge-to-edge legibility scrim on every variant: strong at the bottom
// (where the headline + CTA sit), nearly clear at the centre (the video stays
// the dominant element), moderate at the top (the kicker + nav overlap).
const SCRIM_CLASS = 'absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-black/10 to-black/35';

// Top-left chapter marker — reuses the same champagne dot that is the site's
// brand mark in the nav/footer, so the "which act" indicator reads as part of
// the same visual language, not a new invented glyph.
function ActKicker({ index }) {
  return (
    <div className="eyebrow-accent flex items-center gap-3">
      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-champagne" />
      Act {ACT_ORDINALS[index]}
    </div>
  );
}

// Quiet on purpose: the headline carries all the weight now, the CTA is
// deliberately small and uniform across all 5 acts — no bookend emphasis,
// no Magnetic pointer-attraction, just a clear, findable link.
function ActCTA({ act, onBegin }) {
  return (
    <button
      onClick={onBegin}
      className="btn-premium btn-outline group mt-8 px-7 py-3 rounded-full text-[10px] tracking-[0.22em] uppercase inline-flex items-center gap-2.5"
    >
      {act.cta}
      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-500" />
    </button>
  );
}

function ActHeadline({ act, index, sizeClass }) {
  if (index === 0) {
    // Only the arrival gets the masked line-rise the old hero used — the
    // other four read as chapters of one continuous take, not four more
    // "openings".
    return (
      <h1 className={`font-serif font-display ${sizeClass} leading-[0.98] track-display text-platinum max-w-4xl`}>
        <LineReveal mode="mount" delay={0.5} lines={act.headline} />
      </h1>
    );
  }
  return (
    <h2 className={`font-serif font-display ${sizeClass} leading-[0.98] track-display text-platinum max-w-4xl`}>
      {act.headline}
    </h2>
  );
}

// Desktop: one absolutely-positioned block per act, cross-fading in and out
// of the shared window of scrub progress it owns (1/5th each). Kicker top,
// headline + CTA bottom — same corner, every act.
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
      className="absolute inset-0 flex flex-col justify-between px-8 md:px-16 pt-8 md:pt-12 pb-12 md:pb-16"
    >
      <ActKicker index={index} />
      <div>
        <ActHeadline act={act} index={index} sizeClass="text-[clamp(38px,7vw,128px)]" />
        <ActCTA act={act} onBegin={onBegin} />
      </div>
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
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src={videoSrc('/videos/journey.mp4')} type="video/mp4" />
        </video>
        <div aria-hidden className={SCRIM_CLASS} />
        {ACTS.map((act, i) => (
          <DesktopActBlock key={i} act={act} index={i} progress={progress} onBegin={onBegin} />
        ))}
      </div>
    </div>
  );
}

// Mobile: the video is pinned (sticky) behind the whole 5-screen-tall track,
// exactly like desktop's frame, so it always renders at one viewport's size
// instead of stretching (and getting badly cropped by object-cover) across
// the full stacked height. No currentTime scrub — it just loops in place.
// Each act gets its own full-height slot scrolling over it, fading in once.
function JourneyScrubMobile({ onBegin }) {
  const reduce = useReducedMotion();
  const videoRef = useRef(null);
  useAutoplayInView({ videoRef, enabled: !reduce });
  const count = ACTS.length;

  return (
    <div className="relative bg-black" style={{ height: `${count * 100}svh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <video
          ref={videoRef}
          aria-hidden
          muted
          playsInline
          preload="none"
          poster="/videos/journey-mobile-poster.jpg"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src={videoSrc('/videos/journey-mobile.mp4')} type="video/mp4" />
        </video>
        <div aria-hidden className={SCRIM_CLASS} />
      </div>
      <div className="absolute inset-0">
        {ACTS.map((act, i) => (
          <div key={i} className="absolute inset-x-0 h-[100svh]" style={{ top: `${i * 100}svh` }}>
            <motion.div
              initial={i === 0 ? undefined : { opacity: 0, y: 20 }}
              whileInView={i === 0 ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30% 0px -30% 0px' }}
              transition={{ duration: 1.2, ease: EASE }}
              className="h-full flex flex-col justify-between px-6 pt-8 pb-14"
            >
              <ActKicker index={i} />
              <div>
                <ActHeadline act={act} index={i} sizeClass="text-[clamp(34px,10vw,64px)]" />
                <ActCTA act={act} onBegin={onBegin} />
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reduced motion: no video at all, just the desktop poster as a static,
// fixed-attachment backdrop (bg-fixed is not an animation, so it stays
// available here) with the five chapters stacked underneath in normal flow —
// same left-anchored language, no motion.
function JourneyReduced({ onBegin }) {
  return (
    <section
      className="relative bg-black bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/videos/journey-poster.jpg')" }}
    >
      <div aria-hidden className={SCRIM_CLASS} />
      <div className="relative max-w-4xl px-6 md:px-16 py-24 md:py-32 space-y-24">
        {ACTS.map((act, i) => (
          <div key={i}>
            <ActKicker index={i} />
            <div className="mt-6">
              <ActHeadline act={act} index={i} sizeClass="text-[clamp(30px,7vw,60px)]" />
              <ActCTA act={act} onBegin={onBegin} />
            </div>
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
