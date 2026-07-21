'use client';

// Phase-1 harness for the scroll-scrub engine. This route is NOT the landing —
// it exists only to prove SmoothScroll + useVideoScrub work before we wire any
// real act. The copy here is throwaway placeholder, deliberately unrelated to
// the trailer script, so nothing here is load-bearing for SEO.
//
// To see the scrub: drop ANY .mp4 at /public/videos/placeholder.mp4 and scroll.
// With no file present, the poster shows and the HUD still reports live scroll
// progress + the target time the engine would seek to — so the engine is
// verifiable even before the real clips land.

import { useRef } from 'react';
import SmoothScroll from '@/components/fx/SmoothScroll';
import { useVideoScrub } from '@/lib/useVideoScrub';

function ScrubStage() {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const { active, progress } = useVideoScrub({ videoRef, trackRef });

  return (
    <div ref={trackRef} className="relative h-[300vh] bg-black">
      <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">
        {/* decorative video layer — behind the copy, never carries content */}
        <video
          ref={videoRef}
          aria-hidden
          muted
          playsInline
          preload="auto"
          poster="/landing/ethos-2560.webp"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src="/videos/placeholder.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* placeholder copy — always in the DOM, above the video */}
        <div className="relative z-10 text-center px-8">
          <div className="text-[10px] tracking-[0.4em] uppercase text-white/40 mb-6">
            Scrub engine · Phase 1
          </div>
          <h1 className="font-serif text-[clamp(36px,7vw,72px)] leading-[1.02] text-white">
            Scroll drives the frame.
          </h1>
          <p className="mt-6 text-white/55 text-[15px] font-light max-w-md mx-auto leading-[1.8]">
            Placeholder harness. Drop a clip at <code className="text-champagne">/videos/placeholder.mp4</code> to see it scrub.
          </p>
        </div>

        {/* live engine readout */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 rounded-full bg-white/[0.06] backdrop-blur px-6 py-3 text-[11px] tracking-widest uppercase text-white/70 tabular-nums">
          <span>scrub: <b className={active ? 'text-champagne' : 'text-white/40'}>{active ? 'active' : 'fallback'}</b></span>
          <span>progress: <b className="text-white">{(progress * 100).toFixed(1)}%</b></span>
        </div>
      </div>
    </div>
  );
}

export default function ScrubDemoPage() {
  return (
    <SmoothScroll>
      <main className="bg-black">
        <div className="h-screen flex flex-col items-center justify-center text-center px-8">
          <h2 className="font-serif text-[clamp(32px,6vw,64px)] text-white leading-tight">Keep scrolling.</h2>
          <p className="mt-6 text-white/45 text-sm tracking-widest uppercase">The scrub stage is below</p>
        </div>
        <ScrubStage />
        <div className="h-screen flex items-center justify-center">
          <p className="text-white/40 text-sm tracking-widest uppercase">End of harness</p>
        </div>
      </main>
    </SmoothScroll>
  );
}
