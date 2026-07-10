'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { getBrowserClient } from '@/lib/supabase';
import {
  ArrowRight, ArrowUpRight, Sparkles, Feather, Flame, Mountain,
  MessageSquare, Send, Plus, Users, Home as HomeIcon,
  History, User, ChevronRight, Check, Loader2, Star, Trophy, RotateCcw,
  Circle, Menu, X
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ENTRY_TYPES = [
  { key: 'milestone', label: 'Milestone', icon: Trophy },
  { key: 'reflection', label: 'Reflection', icon: Feather },
  { key: 'victory', label: 'Victory', icon: Star },
  { key: 'failure', label: 'Failure', icon: Flame },
  { key: 'restart', label: 'Restart', icon: RotateCcw },
];

function Ambient() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(212,180,131,0.08),transparent),radial-gradient(900px_500px_at_90%_20%,rgba(238,236,229,0.04),transparent)]" />
      <div className="absolute inset-0 dot-field opacity-40" />
      <div className="absolute inset-0 vignette" />
    </div>
  );
}

function Globe({ size = 480 }) {
  const points = useMemo(() => {
    const N = 900;
    const arr = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = i * Math.PI * (3 - Math.sqrt(5));
      arr.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
    }
    return arr;
  }, []);
  const [rot, setRot] = useState(0);
  useEffect(() => {
    let raf;
    const tick = () => { setRot((r) => (r + 0.0025) % (Math.PI * 2)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const R = size / 2 - 12; const cx = size / 2, cy = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full gold-glow" />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
        <defs>
          <radialGradient id="gShade" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(212,180,131,0.06)" />
            <stop offset="70%" stopColor="rgba(9,9,9,0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="url(#gShade)" />
        {points.map((p, i) => {
          const cR = Math.cos(rot), sR = Math.sin(rot);
          const x = p.x * cR - p.z * sR;
          const z = p.x * sR + p.z * cR;
          const front = z > -0.2;
          const opacity = front ? 0.35 + z * 0.55 : 0.05;
          const s2 = front ? 1.2 + z * 0.9 : 0.8;
          return <circle key={i} cx={cx + x * R} cy={cy + p.y * R} r={s2} fill={i % 37 === 0 ? '#d4b483' : '#eeece5'} opacity={opacity} />;
        })}
      </svg>
      <div className="absolute inset-2 rounded-full border animate-slowspin" style={{ borderColor: 'rgba(212,180,131,0.08)' }} />
    </div>
  );
}

function Counter({ value, duration = 1600 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.floor(value * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span>{n.toLocaleString()}</span>;
}

function SectionCinematic({ id, image, overlay = 'bg-black/60', children }) {
  return (
    <section id={id} className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={image} alt="" className="w-full h-full object-cover animate-kenburns" loading="lazy" />
        <div className={`absolute inset-0 ${overlay}`} />
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

function MethodRow({ step, reverse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-120px' }}
      transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      className={`grid md:grid-cols-12 gap-10 md:gap-20 items-center`}
    >
      <div className={`md:col-span-7 ${reverse ? 'md:order-2' : ''}`}>
        <div className="relative aspect-[16/10] overflow-hidden">
          <img src={step.img} alt="" className="w-full h-full object-cover animate-kenburns" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      </div>
      <div className="md:col-span-5">
        <div className="text-[10px] tracking-[0.38em] uppercase text-champagne/70 mb-8">{step.n}</div>
        <div className="font-serif text-[36px] md:text-[48px] text-white leading-[1.05] tracking-[-0.01em] mb-8">{step.t}</div>
        <div className="text-white/55 text-[16px] leading-[1.85] font-light max-w-md">{step.d}</div>
      </div>
    </motion.div>
  );
}

/* ============ Starfield — canvas, minimal cost, 30fps ============ */
function Starfield({ density = 0.00025, parallax = 0.35 }) {
  const canvasRef = useRef(null);
  const scrollYRef = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    let raf;
    let last = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor(w * h * density);
      stars = new Array(count).fill(0).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.7 + 0.3,   // depth 0.3–1
        r: Math.random() * 1.1 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.1, // twinkle rate
        drift: (Math.random() - 0.5) * 0.02,
      }));
    }

    function onScroll() { scrollYRef.current = window.scrollY; }

    function frame(t) {
      // throttle to ~30fps
      if (t - last < 33) { raf = requestAnimationFrame(frame); return; }
      last = t;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const sy = scrollYRef.current * parallax;
      for (const s of stars) {
        s.x += s.drift;
        if (s.x < -2) s.x = w + 2; if (s.x > w + 2) s.x = -2;
        const y = ((s.y - sy * s.z) % (h + 100) + (h + 100)) % (h + 100);
        const alpha = 0.35 + Math.sin(t * 0.0009 * s.speed + s.phase) * 0.35;
        const finalA = Math.max(0.05, Math.min(1, alpha * s.z));
        ctx.beginPath();
        ctx.fillStyle = s.z > 0.85
          ? `rgba(230,220,200,${finalA})`
          : `rgba(200,215,240,${finalA * 0.9})`;
        ctx.arc(s.x, y, s.r * s.z, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [density, parallax]);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: 'block' }} />;
}

function EarthGlobe({ size = 'large' }) {
  const sizeClass = size === 'large'
    ? 'w-[min(82vw,520px)] md:w-[min(42vw,560px)]'
    : 'w-[280px] md:w-[320px]';
  return (
    <div className={`relative ${sizeClass} aspect-square`}>
      {/* outer soft atmospheric halo — breathes */}
      <div
        className="absolute inset-[-22%] rounded-full pointer-events-none animate-atmosphere-breath"
        style={{ background: 'radial-gradient(circle, rgba(90,145,225,0.22) 40%, rgba(90,145,225,0.06) 62%, transparent 74%)' }}
      />
      {/* inner tight atmosphere */}
      <div
        className="absolute inset-[-6%] rounded-full pointer-events-none blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(70,130,220,0.28) 30%, transparent 65%)' }}
      />
      {/* rotating earth disc */}
      <div
        className="relative w-full h-full rounded-full overflow-hidden animate-earthspin"
        style={{
          boxShadow:
            '0 0 100px -10px rgba(88,140,220,0.4), inset 0 -12px 60px rgba(0,0,0,0.55), inset 0 0 30px rgba(0,0,0,0.3)',
        }}
      >
        <img
          src="/earth.jpg"
          alt="Earth from orbit"
          className="absolute inset-0 w-full h-full object-cover select-none"
          style={{ transform: 'scale(1.55)', objectPosition: 'center' }}
          draggable="false"
          loading="eager"
          fetchpriority="high"
        />
      </div>
      {/* darken far side rim for sphere illusion */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle at 38% 38%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
      />
      {/* subtle top-left highlight (spec) */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none mix-blend-screen opacity-40"
        style={{ background: 'radial-gradient(circle at 30% 25%, rgba(180,210,255,0.12), transparent 45%)' }}
      />
    </div>
  );
}

function Landing({ onBegin, onExplore, onSignIn, stats }) {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.35], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0]);

  return (
    <div className="relative bg-black">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-black/30">
        <div className="max-w-[1440px] mx-auto px-6 md:px-14 py-5 md:py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-champagne" />
            <span className="text-[10px] md:text-[11px] tracking-[0.28em] md:tracking-[0.3em] uppercase text-white/90 font-medium">Monument of Dreams</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-[12px] tracking-wide text-white/55">
            <a href="#ethos" className="nav-link hover:text-white">Ethos</a>
            <a href="#how" className="nav-link hover:text-white">Method</a>
            <a href="#world" className="nav-link hover:text-white">Live</a>
            <a href="#mentor" className="nav-link hover:text-white">Mentor</a>
            <a href="#premium" className="nav-link hover:text-white">Eternal</a>
          </div>
          <div className="flex items-center gap-5">
            {onSignIn && <button onClick={onSignIn} className="text-[10px] md:text-[11px] tracking-[0.24em] uppercase text-white/55 hover:text-white transition-colors duration-500">Sign In</button>}
            <button onClick={onBegin} className="text-[10px] md:text-[11px] tracking-[0.24em] uppercase text-white/80 hover:text-white transition-colors duration-500 flex items-center gap-2">
              Enter <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO — Earth rotating on left, text on right */}
      <section className="relative min-h-[100svh] overflow-hidden flex items-center justify-center bg-black">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(20,35,75,0.28),transparent_65%)]" />
          <Starfield density={0.00028} parallax={0.4} />
          <div className="absolute inset-0 dot-field opacity-20" />
          <div className="absolute inset-0 vignette" />
          <div className="film-grain" />
        </div>

        <div className="relative w-full max-w-[1400px] mx-auto px-6 md:px-14 pt-28 md:pt-24 pb-20 md:pb-0 grid md:grid-cols-2 gap-14 md:gap-4 items-center">
          {/* Earth */}
          <motion.div
            style={{ y: heroY }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center md:justify-start order-1 animate-hero-drift"
          >
            <EarthGlobe size="large" />
          </motion.div>

          {/* Text */}
          <motion.div
            style={{ opacity: heroOpacity }}
            className="relative order-2 text-center md:text-left"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 0.5 }}
              className="text-[10px] tracking-[0.4em] uppercase text-white/50 mb-6 md:mb-10"
            >
              Monument of Dreams
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 2, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="font-serif text-[clamp(38px,9vw,88px)] leading-[0.98] tracking-[-0.025em] text-white"
            >
              Every dream deserves<br />
              <span className="italic text-white/90">a monument.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 1.3 }}
              className="mt-6 md:mt-10 text-[14px] md:text-[17px] text-white/60 max-w-md mx-auto md:mx-0 leading-[1.8] md:leading-[1.85] font-light tracking-wide"
            >
              Preserve your journey. Build your future.<br className="hidden sm:block" /> Become who you dream of becoming.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.6, delay: 1.8 }}
              className="mt-10 md:mt-14 flex flex-col lg:flex-row items-center md:items-start justify-center md:justify-start gap-3 sm:gap-4"
            >
              <button
                onClick={onBegin}
                className="group w-full sm:w-auto whitespace-nowrap px-8 md:px-10 py-4 rounded-full bg-white text-black text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-white/95 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-15px_rgba(255,255,255,0.35)] active:translate-y-0 active:scale-[0.98] transition-all duration-500 sheen flex items-center justify-center gap-3"
              >
                Create My Monument
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-500" />
              </button>
              <button
                onClick={onExplore}
                className="w-full sm:w-auto whitespace-nowrap px-8 md:px-10 py-4 rounded-full border border-white/15 text-[11px] tracking-[0.24em] uppercase text-white/80 hover:text-white hover:border-white/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-500"
              >
                Explore the Community
              </button>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.8, duration: 1.5 }}
          className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-[9px] tracking-[0.4em] uppercase flex-col items-center gap-4"
        >
          <span>Scroll</span>
          <div className="w-px h-14 bg-gradient-to-b from-white/40 to-transparent" />
        </motion.div>
      </section>

      {/* ETHOS */}
      <SectionCinematic
        id="ethos"
        image="https://images.unsplash.com/photo-1579722139701-f9222eded3b6?auto=format&fit=crop&w=2400&q=85"
        overlay="bg-gradient-to-b from-black via-black/45 to-black"
      >
        <div className="relative max-w-4xl mx-auto text-center px-8 py-56 md:py-72">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 2 }} className="text-[10px] tracking-[0.4em] uppercase text-white/40 mb-12">
            Why we exist
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }} className="font-serif text-[42px] md:text-[72px] leading-[1.08] tracking-[-0.02em] text-white">
            The world remembers<br />
            those who <span className="italic text-white/85">arrived.</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 2, delay: 0.5 }} className="mt-14 text-white/55 text-base md:text-lg font-light leading-[2] max-w-2xl mx-auto">
            We remember everyone still walking.
            <br /><br />
            The sacrifices. The failures. The restarts. The quiet mornings no one ever saw. Nothing about your journey deserves to disappear.
          </motion.p>
        </div>
      </SectionCinematic>

      {/* METHOD */}
      <section id="how" className="relative bg-black">
        <div className="max-w-[1200px] mx-auto px-8 md:px-14 py-40 md:py-56">
          <div className="grid md:grid-cols-2 gap-20 items-end mb-32">
            <div>
              <div className="text-[10px] tracking-[0.4em] uppercase text-white/40 mb-10">The Rite</div>
              <h2 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-white">
                Three acts.<br />
                <span className="italic text-white/60">One life.</span>
              </h2>
            </div>
            <p className="text-white/50 text-[16px] leading-[1.85] font-light max-w-md md:justify-self-end">
              Not another productivity app. A single, deliberate ritual repeated across a lifetime — until it becomes the thing you leave behind.
            </p>
          </div>

          <div className="space-y-40">
            {[
              { n: '01', t: 'Name the story', d: 'Not a task list. A north star. The story only you can tell, spoken out loud for the first time.', img: 'https://images.pexels.com/photos/2102546/pexels-photo-2102546.jpeg?auto=compress&cs=tinysrgb&w=1800' },
              { n: '02', t: 'Lay each stone', d: 'Every failure. Every restart. Every quiet victory no one saw. One inscription at a time. Nothing disappears.', img: 'https://images.unsplash.com/photo-1468322638156-074863f9362e?auto=format&fit=crop&w=1800&q=85' },
              { n: '03', t: 'Become the archive', d: 'A living record of your becoming, guarded by an intelligence that has been walking beside you from the first stone.', img: 'https://images.pexels.com/photos/16827297/pexels-photo-16827297.jpeg?auto=compress&cs=tinysrgb&w=1800' },
            ].map((s, i) => (
              <MethodRow key={s.n} step={s} reverse={i % 2 === 1} />
            ))}
          </div>
        </div>
      </section>

      {/* WORLD LIVE */}
      <SectionCinematic
        id="world"
        image="https://images.unsplash.com/photo-1577438569227-4b3445c673cf?auto=format&fit=crop&w=2400&q=90"
        overlay="bg-gradient-to-b from-black/85 via-black/55 to-black"
      >
        <div className="relative max-w-[1200px] mx-auto px-8 md:px-14 py-40 md:py-56">
          <div className="text-[10px] tracking-[0.4em] uppercase text-white/45 mb-10">Live · Global</div>
          <h2 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-white max-w-2xl">
            The world is <span className="italic text-white/80">walking.</span>
          </h2>
          <p className="mt-10 text-white/55 text-[16px] font-light max-w-xl leading-[1.85]">
            Real journeys. Real people. Preserved as they happen — not after they end.
          </p>

          <div className="mt-28 grid md:grid-cols-4 gap-12 md:gap-8">
            {[
              { label: 'Stories declared', value: stats?.dreamsCreated ?? 12847 },
              { label: 'Stones laid today', value: stats?.dreamsCompletedToday ?? 342 },
              { label: 'Walkers present', value: stats?.buildersOnline ?? 1247 },
              { label: 'Countries', value: stats?.countries ?? 96 },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 1.4, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="font-serif text-[56px] md:text-[76px] text-white leading-none tracking-[-0.03em] tabular">
                  <Counter value={s.value} duration={2400} />
                </div>
                <div className="mt-6 text-[10px] tracking-[0.32em] uppercase text-white/45">{s.label}</div>
                <div className="mt-6 h-px w-14 bg-white/20" />
              </motion.div>
            ))}
          </div>
        </div>
      </SectionCinematic>

      {/* MENTOR */}
      <section id="mentor" className="relative bg-black">
        <div className="max-w-[1200px] mx-auto px-8 md:px-14 py-40 md:py-56 grid md:grid-cols-12 gap-16 md:gap-20 items-center">
          <div className="md:col-span-6">
            <div className="text-[10px] tracking-[0.4em] uppercase text-champagne/70 mb-10">Guardian of the Journey</div>
            <h2 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-white">
              An intelligence that <span className="italic text-white/70">walks with you.</span>
            </h2>
            <p className="mt-10 text-white/55 text-[16px] leading-[1.95] font-light max-w-lg">
              Not a coach. Not a chatbot. The Guardian remembers every stone you have laid. It never gives generic motivation. It only speaks to you using your own story — and reminds you, when you forget, how far you have already come.
            </p>
            <div className="mt-14 space-y-5 max-w-md">
              {['Remembers every entry of your journey', 'Connects memories you cannot see', 'Reminds you how much you have grown', 'Speaks only in the language of your story'].map((f) => (
                <div key={f} className="flex items-start gap-4 text-white/70">
                  <div className="mt-2.5 w-1 h-1 rounded-full bg-champagne shrink-0" />
                  <span className="text-[15px] font-light leading-relaxed">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }} className="md:col-span-6">
            <div className="relative bg-gradient-to-br from-white/[0.04] via-white/[0.015] to-transparent p-10 md:p-14 rounded-sm" style={{ boxShadow: '0 40px 100px -40px rgba(212,176,106,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <div className="text-[10px] tracking-[0.35em] uppercase text-white/40 mb-8">A Sunday, quietly</div>
              <div className="font-serif text-[22px] md:text-[28px] leading-[1.4] text-white/90">
                &ldquo;I see three restarts this month around the same block. This is not weakness. It is a signal. The story is asking for a smaller commitment, not a bigger one. Try twelve minutes tomorrow. Only twelve. Then come and inscribe it.&rdquo;
              </div>
              <div className="mt-12 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-[10px] tracking-[0.32em] uppercase text-white/45">Guardian</div>
                <div className="text-[10px] tracking-wider text-white/25">remembered forever</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PREMIUM */}
      <section id="premium" className="relative bg-black">
        <div className="max-w-[1200px] mx-auto px-8 md:px-14 py-40 md:py-56">
          <div className="max-w-2xl mb-28">
            <div className="text-[10px] tracking-[0.4em] uppercase text-white/40 mb-10">Monument Eternal</div>
            <h2 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-white">
              For the ones who <span className="italic text-white/70">refuse to be forgotten.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-12 gap-16 md:gap-20 items-start">
            <div className="md:col-span-5 space-y-0">
              {['Unlimited Monument', 'The Guardian, always with you', 'Yearly Life Book, printed', 'Timeline preserved forever', 'Life Chapters, auto-written', 'Time Capsules to your future self', 'Full journey export'].map((f) => (
                <div key={f} className="flex items-center gap-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <Check className="w-3 h-3 text-champagne shrink-0" strokeWidth={2.5} />
                  <span className="text-white/80 text-[15px] font-light">{f}</span>
                </div>
              ))}
            </div>
            <div className="md:col-span-6 md:col-start-7">
              <div className="p-10 md:p-14 rounded-sm bg-gradient-to-br from-white/[0.04] via-white/[0.015] to-transparent" style={{ boxShadow: '0 40px 100px -40px rgba(212,176,106,0.18), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <div className="flex items-baseline justify-between mb-10">
                  <div>
                    <div className="text-[10px] tracking-[0.4em] uppercase text-champagne mb-4">Eternal</div>
                    <div className="text-white/55 text-[13px] font-light">Monthly · billed yearly</div>
                  </div>
                  <div className="font-serif text-[72px] md:text-[88px] text-white leading-none tracking-[-0.03em]">$12</div>
                </div>
                <p className="text-white/50 text-[15px] font-light leading-[1.95] max-w-md mb-12">
                  One quiet subscription. No tiers. No ads. No noise. Only the Monument, in the highest resolution we know how to preserve a human life.
                </p>
                <button onClick={onBegin} className="group w-full py-4 rounded-full bg-white text-black text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-white/95 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-15px_rgba(255,255,255,0.35)] active:translate-y-0 active:scale-[0.98] transition-all duration-500 sheen flex items-center justify-center gap-3">
                  Begin Eternal
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <SectionCinematic
        image="https://images.unsplash.com/photo-1534996858221-380b92700493?auto=format&fit=crop&w=2400&q=90"
        overlay="bg-gradient-to-b from-black/85 via-black/60 to-black"
      >
        <div className="relative max-w-4xl mx-auto text-center px-8 py-56 md:py-72">
          <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }} className="font-serif text-[56px] md:text-[104px] leading-[0.98] tracking-[-0.025em] text-white">
            Your story<br />
            <span className="italic text-white/85">has already begun.</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 2, delay: 0.4 }} className="mt-12 text-white/55 text-[16px] font-light tracking-wide">
            Now it will be remembered.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, delay: 0.7 }}
            onClick={onBegin}
            className="mt-16 group px-12 py-5 rounded-full bg-white text-black text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-white/95 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-15px_rgba(255,255,255,0.35)] active:translate-y-0 active:scale-[0.98] transition-all duration-500 sheen inline-flex items-center gap-3"
          >
            Raise My Monument
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-500" />
          </motion.button>
        </div>
      </SectionCinematic>

      {/* FOOTER */}
      <footer className="bg-black">
        <div className="max-w-[1200px] mx-auto px-8 md:px-14 py-14 flex flex-col md:flex-row items-center justify-between gap-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-champagne" />
            <span className="text-[11px] tracking-[0.3em] uppercase text-platinum/70">Monument of Dreams</span>
          </div>
          <div className="text-[10px] tracking-[0.35em] uppercase text-platinum/30">MMXXV · No journey forgotten</div>
        </div>
      </footer>
    </div>
  );
}

function Onboard({ onDone, onCancel, userId }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [dream, setDream] = useState('');
  const [purpose, setPurpose] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [values, setValues] = useState([]);
  const [saving, setSaving] = useState(false);
  const VALUE_OPTIONS = ['Discipline', 'Freedom', 'Craft', 'Legacy', 'Love', 'Truth', 'Adventure', 'Mastery', 'Health', 'Impact'];

  const steps = [
    { q: 'What name shall we inscribe first?', hint: 'The one you were given, or the one you have chosen. It goes at the top of the Monument.', input: (
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="bg-transparent border-0 border-b hairline-strong rounded-none text-4xl md:text-5xl font-serif h-20 focus-visible:ring-0 px-0 text-platinum placeholder:text-platinum/20" />
    ), canNext: name.trim().length > 0 },
    { q: 'What is the story you are here to tell?', hint: 'One sentence. The one you have been afraid to say out loud.', input: (
      <Textarea autoFocus value={dream} onChange={(e) => setDream(e.target.value)} placeholder="I am here to…" className="bg-transparent border-0 border-b hairline-strong rounded-none text-3xl md:text-4xl font-serif focus-visible:ring-0 px-0 text-platinum placeholder:text-platinum/20 min-h-[120px] resize-none leading-tight" />
    ), canNext: dream.trim().length > 4 },
    { q: 'Why must it be told, and why through you?', hint: 'The reason that would survive a bad day, a bad year, a bad silence.', input: (
      <Textarea autoFocus value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Because…" className="bg-transparent border-0 border-b hairline-strong rounded-none text-2xl md:text-3xl font-serif focus-visible:ring-0 px-0 text-platinum placeholder:text-platinum/20 min-h-[120px] resize-none" />
    ), canNext: purpose.trim().length > 3 },
    { q: 'By when must this exist in the world?', hint: 'A year, a season, a chapter of your life. Be honest, not perfect.', input: (
      <Input autoFocus value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="e.g. by 2028, before I turn 30, this decade" className="bg-transparent border-0 border-b hairline-strong rounded-none text-2xl md:text-3xl font-serif focus-visible:ring-0 px-0 text-platinum placeholder:text-platinum/20 h-16" />
    ), canNext: timeframe.trim().length > 0 },
    { q: 'Which words must never leave your Monument?', hint: 'Choose three. They will be inscribed at the base — the ground your story stands on.', input: (
      <div className="flex flex-wrap gap-3">
        {VALUE_OPTIONS.map((v) => {
          const active = values.includes(v);
          return (
            <button key={v} onClick={() => { if (active) setValues(values.filter((x) => x !== v)); else if (values.length < 3) setValues([...values, v]); }} className={`px-5 py-2.5 rounded-full text-sm tracking-wider transition border ${active ? 'bg-champagne/15 border-champagne/50 text-champagne' : 'glass text-platinum/70 hover:border-platinum/30'}`}>{v}</button>
          );
        })}
      </div>
    ), canNext: values.length === 3 },
  ];
  const s = steps[step];

  async function submit() {
    if (!userId) { toast.error('Please sign in first.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, name, dream, purpose, timeframe, values }) });
      const data = await res.json();
      if (data.monument) { toast.success('Your Monument stands.'); onDone(data.monument); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-black overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(20,35,75,0.2),transparent_60%)]" />
        <div className="absolute inset-0 dot-field opacity-15" />
        <div className="absolute inset-0 vignette" />
      </div>
      <div className="absolute top-0 inset-x-0 px-6 md:px-8 py-5 md:py-6 flex justify-between items-center z-10">
        <button onClick={onCancel} className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-platinum/40 hover:text-platinum transition-colors duration-500">← Back</button>
        <div className="flex gap-1.5 md:gap-2">
          {steps.map((_, i) => (<div key={i} className={`h-px transition-all duration-500 ${i <= step ? 'bg-champagne w-8 md:w-10' : 'bg-platinum/15 w-6 md:w-8'}`} />))}
        </div>
      </div>
      <div className="relative flex-1 flex items-center justify-center px-6 md:px-8 pt-20 pb-10">
        <div className="max-w-3xl w-full">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/70 mb-4 md:mb-6">Chapter {String(step + 1).padStart(2, '0')} of 05</div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-6xl text-platinum tracking-tight leading-[1.05]">{s.q}</h2>
              <p className="mt-3 md:mt-4 text-platinum/40 text-sm">{s.hint}</p>
              <div className="mt-10 md:mt-16">{s.input}</div>
              <div className="mt-12 md:mt-16 flex items-center justify-between gap-4">
                <button disabled={step === 0} onClick={() => setStep(step - 1)} className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-platinum/50 hover:text-platinum transition disabled:opacity-20">Previous</button>
                {step < steps.length - 1 ? (
                  <button disabled={!s.canNext} onClick={() => setStep(step + 1)} className="group px-6 md:px-8 py-3.5 md:py-4 rounded-full bg-platinum text-obsidian text-[10px] md:text-xs tracking-[0.2em] uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition flex items-center gap-2">Continue <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" /></button>
                ) : (
                  <button disabled={!s.canNext || saving} onClick={submit} className="group px-6 md:px-8 py-3.5 md:py-4 rounded-full bg-champagne text-obsidian text-[10px] md:text-xs tracking-[0.2em] uppercase disabled:opacity-30 hover:bg-champagne-soft transition flex items-center gap-2 gold-glow">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Raise the Monument
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Shell({ view, setView, children, monument, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { k: 'home', label: 'Home', icon: HomeIcon },
    { k: 'timeline', label: 'Monument', icon: History },
    { k: 'mentor', label: 'Guardian', icon: MessageSquare },
    { k: 'community', label: 'Witnesses', icon: Users },
    { k: 'profile', label: 'You', icon: User },
  ];
  const currentLabel = nav.find((n) => n.k === view)?.label || '';
  return (
    <div className="min-h-screen md:flex bg-obsidian">
      {/* MOBILE top bar */}
      <div className="md:hidden sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/8 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-champagne" />
          <span className="text-[10px] tracking-[0.28em] uppercase text-white/85">{currentLabel}</span>
        </div>
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-2 -mr-2">
          <Menu className="w-5 h-5 text-white/80" />
        </button>
      </div>

      {/* MOBILE drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden fixed inset-0 z-[60] bg-black"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.55 }}
              className="h-full w-full flex flex-col p-8 pt-6"
            >
              <div className="flex justify-between items-center mb-16">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-champagne" />
                  <span className="text-[10px] tracking-[0.3em] uppercase text-white/80">Monument</span>
                </div>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="p-2 -mr-2">
                  <X className="w-5 h-5 text-white/80" />
                </button>
              </div>
              <nav className="space-y-1">
                {nav.map((n) => {
                  const active = view === n.k;
                  const Icon = n.icon;
                  return (
                    <button
                      key={n.k}
                      onClick={() => { setView(n.k); setMobileOpen(false); }}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-lg text-lg transition ${
                        active ? 'bg-white/[0.05] text-white' : 'text-white/55 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-serif text-2xl">{n.label}</span>
                      {active && <ChevronRight className="w-4 h-4 ml-auto text-champagne" />}
                    </button>
                  );
                })}
              </nav>
              <div className="mt-auto">
                {monument && (
                  <div className="glass rounded-lg p-5">
                    <div className="text-[9px] tracking-[0.3em] uppercase text-champagne/70 mb-2">The story</div>
                    <div className="text-sm text-white/80 leading-relaxed line-clamp-3">{monument.dream}</div>
                  </div>
                )}
                <button onClick={() => { onLogout(); setMobileOpen(false); }} className="mt-6 w-full text-[10px] tracking-[0.22em] uppercase text-platinum/30 hover:text-platinum/60 transition py-2">
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP sidebar */}
      <aside className="hidden md:flex w-64 border-r hairline p-8 flex-col justify-between sticky top-0 h-screen shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-16">
            <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-champagne to-platinum/40" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-platinum/70">Monument</span>
          </div>
          <nav className="space-y-1">
            {nav.map((n) => {
              const active = view === n.k; const Icon = n.icon;
              return (
                <button key={n.k} onClick={() => setView(n.k)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active ? 'bg-white/[0.04] text-platinum' : 'text-platinum/50 hover:text-platinum hover:bg-white/[0.02]'}`}>
                  <Icon className="w-4 h-4" />{n.label}
                  {active && <ChevronRight className="w-3 h-3 ml-auto text-champagne" />}
                </button>
              );
            })}
          </nav>
        </div>
        <div>
          {monument && (
            <div className="glass rounded-lg p-4">
              <div className="text-[9px] tracking-[0.3em] uppercase text-champagne/70 mb-2">The story</div>
              <div className="text-xs text-platinum/80 leading-relaxed line-clamp-3">{monument.dream}</div>
            </div>
          )}
          <button onClick={onLogout} className="mt-4 w-full text-[10px] tracking-[0.22em] uppercase text-platinum/30 hover:text-platinum/60 transition py-2">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 w-full">{children}</main>
    </div>
  );
}

function Home({ monument, setView, userId }) {
  const [insight, setInsight] = useState(null);
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    if (userId) fetch(`/api/insight?userId=${userId}`).then(r => r.json()).then(d => setInsight(d));
    fetch(`/api/entries?monumentId=${monument.id}`).then(r => r.json()).then(d => setEntries(d.entries || []));
  }, [monument.id]);
  const daysSince = Math.floor((Date.now() - new Date(monument.createdAt).getTime()) / 86400000) + 1;
  const entriesCount = entries?.length ?? 0;
  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] } }),
  };
  return (
    <div className="px-6 md:px-16 py-10 md:py-16 max-w-6xl">
      <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80 mb-4">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-platinum tracking-tight leading-[1.05]">Your story continues, <em className="text-gold-shimmer not-italic">{monument.name}</em>.</h1>
      <p className="mt-4 text-platinum/50 text-base md:text-lg">Day {daysSince} preserved. The Monument is listening.</p>
      <motion.div initial="hidden" animate="show" className="mt-10 md:mt-16 grid sm:grid-cols-3 gap-4 md:gap-6">
        <motion.div custom={0} variants={cardVariants} className="glass rounded-xl p-6">
          <div className="text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-3">Preserved today</div>
          <div className="font-serif text-4xl text-platinum tabular">{entries === null ? <span className="skeleton inline-block w-10 h-10" /> : entriesCount}</div>
          <div className="text-xs text-platinum/50 mt-1">{entriesCount === 1 ? 'stone inscribed' : 'stones inscribed'}</div>
        </motion.div>
        <motion.div custom={1} variants={cardVariants} className="glass rounded-xl p-6 sm:col-span-2">
          <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-3">The story you are telling</div>
          <div className="font-serif text-xl md:text-2xl text-platinum leading-tight">{monument.dream}</div>
          <div className="mt-3 text-xs text-platinum/40">Toward: {monument.timeframe}</div>
        </motion.div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.24, ease: [0.16, 1, 0.3, 1] }} className="mt-6 glass rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-champagne" />
          <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70">Guardian · today&apos;s reflection</div>
        </div>
        {insight?.insight ? (
          <div className="space-y-3">
            {insight.insight.map((s, i) => (<div key={i} className="text-platinum/80 leading-relaxed font-light text-[15px] md:text-base">{s}</div>))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        )}
        <button onClick={() => setView('mentor')} className="mt-6 text-xs tracking-[0.2em] uppercase text-champagne hover:text-champagne-soft transition-colors duration-500 flex items-center gap-2 group">Speak to the Guardian <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-500" /></button>
      </motion.div>
      <div className="mt-14 md:mt-16 flex items-end justify-between">
        <h2 className="font-serif text-2xl md:text-3xl text-platinum">The next stone</h2>
        <button onClick={() => setView('timeline')} className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-platinum/50 hover:text-platinum">Open the Monument →</button>
      </div>
      <div className="mt-6 glass rounded-xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="text-platinum/80 leading-relaxed text-[15px] md:text-base">Add a stone. A reflection, a victory, an honest failure, a restart. One more day of the story becomes permanent.</div>
        <button onClick={() => setView('timeline')} className="shrink-0 px-6 py-3 rounded-full bg-platinum text-obsidian text-[10px] md:text-xs tracking-[0.2em] uppercase hover:bg-white transition flex items-center gap-2"><Plus className="w-3 h-3" /> Inscribe</button>
      </div>
    </div>
  );
}

function Timeline({ monument, userId }) {
  const [entries, setEntries] = useState([]);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('reflection');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  async function load() {
    const r = await fetch(`/api/entries?monumentId=${monument.id}`);
    const d = await r.json();
    setEntries(d.entries || []);
  }
  useEffect(() => { load(); }, [monument.id]);
  async function save() {
    if (!content.trim()) return;
    setSaving(true);
    const r = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monumentId: monument.id, userId, type, title, content }) });
    const d = await r.json();
    if (d.entry) { toast.success('Stone inscribed. Permanent.'); setContent(''); setTitle(''); setAdding(false); await load(); }
    setSaving(false);
  }
  return (
    <div className="px-6 md:px-16 py-10 md:py-16 max-w-4xl">
      <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80 mb-4">The Archive</div>
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-platinum tracking-tight leading-[1.05]">{monument.name}&apos;s Monument</h1>
      <p className="mt-4 text-platinum/50 text-base md:text-lg leading-relaxed max-w-2xl">Every stone here is permanent. Nothing about this journey will be forgotten.</p>
      <div className="mt-3 text-platinum/40 text-sm md:text-base italic font-serif">{monument.dream}</div>
      <div className="mt-4 flex gap-2 flex-wrap">
        {(monument.values || []).map((v) => (<span key={v} className="text-[10px] tracking-[0.2em] uppercase text-champagne/80 px-3 py-1 rounded-full border border-champagne/20">{v}</span>))}
      </div>
      <div className="mt-12">
        {!adding ? (
          <button onClick={() => setAdding(true)} className="w-full glass rounded-xl p-6 text-left hover:border-champagne/30 transition group">
            <div className="flex items-center gap-3 text-platinum/50 group-hover:text-platinum transition"><Plus className="w-4 h-4" /><span className="text-sm">Lay another stone</span></div>
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-8 space-y-6">
            <div className="flex flex-wrap gap-2">
              {ENTRY_TYPES.map((t) => {
                const Icon = t.icon; const active = type === t.key;
                return (<button key={t.key} onClick={() => setType(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs tracking-wider transition border ${active ? 'bg-champagne/15 border-champagne/50 text-champagne' : 'hairline text-platinum/60 hover:text-platinum'}`}><Icon className="w-3 h-3" /> {t.label}</button>);
              })}
            </div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give this stone a name (optional)" className="bg-transparent border-0 border-b hairline rounded-none text-2xl font-serif h-14 px-0 focus-visible:ring-0 text-platinum placeholder:text-platinum/20" />
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What happened today. What it meant." className="bg-transparent border hairline rounded-lg text-base focus-visible:ring-1 focus-visible:ring-champagne/40 text-platinum placeholder:text-platinum/20 min-h-[140px]" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setAdding(false)} className="px-6 py-2.5 text-xs tracking-[0.2em] uppercase text-platinum/50 hover:text-platinum">Cancel</button>
              <button disabled={saving || !content.trim()} onClick={save} className="px-6 py-2.5 rounded-full bg-champagne text-obsidian text-xs tracking-[0.2em] uppercase disabled:opacity-30 hover:bg-champagne-soft transition flex items-center gap-2">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Inscribe
              </button>
            </div>
          </motion.div>
        )}
      </div>
      <div className="mt-14 md:mt-16 relative pl-10 md:pl-12">
        <div className="absolute left-4 top-2 bottom-2 w-px timeline-line" />
        <div className="space-y-8 md:space-y-10">
          {entries.map((e, i) => {
            const t = ENTRY_TYPES.find((x) => x.key === e.type) || { icon: Mountain, label: e.type };
            const Icon = t.icon;
            return (
              <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }} whileHover={{ x: 4 }} className="relative group">
                <div className="absolute -left-10 md:-left-12 top-1 w-7 h-7 md:w-8 md:h-8 rounded-full glass flex items-center justify-center border border-champagne/20 group-hover:border-champagne/50 group-hover:shadow-[0_0_20px_-5px_rgba(212,180,131,0.35)] transition-all duration-500"><Icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-champagne" /></div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-2">{t.label} · {new Date(e.createdAt).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                {e.title && <div className="font-serif text-xl md:text-2xl text-platinum mb-2 leading-tight">{e.title}</div>}
                <div className="text-platinum/70 leading-relaxed font-light whitespace-pre-wrap text-[15px] md:text-base">{e.content}</div>
              </motion.div>
            );
          })}
          {entries.length === 0 && (
            <div className="glass rounded-xl p-10 md:p-14 max-w-xl">
              <div className="w-10 h-10 rounded-full glass flex items-center justify-center border border-champagne/25 mb-5">
                <Feather className="w-3.5 h-3.5 text-champagne" />
              </div>
              <div className="font-serif text-xl md:text-2xl text-platinum/85 leading-tight">Your archive is waiting.</div>
              <div className="mt-3 text-platinum/50 text-sm">Lay the first stone. One honest thought, one small victory, one restart. It becomes permanent the moment you inscribe it.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mentor({ userId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/mentor/history?userId=${userId}`).then(r => r.json()).then(d => setMessages(d.messages || []));
  }, [userId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  async function send() {
    if (!input.trim() || !userId) return;
    const msg = input.trim(); setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg, createdAt: new Date().toISOString() }]);
    setSending(true);
    try {
      const r = await fetch('/api/mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, message: msg }) });
      const d = await r.json();
      setMessages((m) => [...m, { role: 'assistant', content: d.reply, createdAt: new Date().toISOString() }]);
      if (d.usedFallback) toast.warning('Mentor is thinking in reserve mode.');
    } catch { toast.error('Could not reach the Mentor.'); } finally { setSending(false); }
  }
  const starters = ['What have I preserved this week?', 'What pattern lives in my journey?', 'What is the next honest stone?', 'I feel invisible today. Remind me.'];
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <div className="px-6 md:px-16 py-6 md:py-8 border-b hairline">
        <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80">Guardian of the Journey</div>
        <div className="font-serif text-2xl md:text-3xl text-platinum mt-1">Every word remembered.</div>
      </div>
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-6 md:px-16 py-8 md:py-10">
        {/* subtle top/bottom fades for premium feel */}
        <div className="pointer-events-none sticky top-0 -mt-8 md:-mt-10 h-8 md:h-10 bg-gradient-to-b from-obsidian to-transparent z-10" />
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center border border-champagne/25">
                  <Sparkles className="w-3.5 h-3.5 text-champagne" />
                </div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70">Guardian · listening</div>
              </div>
              <div className="font-serif text-2xl md:text-3xl text-platinum/85 leading-[1.35] max-w-xl">
                I have been walking beside you. I remember every stone you have laid. Ask me anything about the journey.
              </div>
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-xs px-4 py-2.5 rounded-full glass hover:border-champagne/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-500 text-platinum/70"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[80%] ${m.role === 'user' ? 'glass px-4 md:px-5 py-3 rounded-2xl rounded-br-md text-platinum' : ''}`}>
                {m.role === 'assistant' && (<div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-2">Guardian</div>)}
                <div className={`leading-relaxed ${m.role === 'assistant' ? 'font-serif text-lg md:text-xl text-platinum/90' : 'text-sm'}`}>{m.content}</div>
              </div>
            </motion.div>
          ))}
          {sending && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70">Guardian</div>
              <div className="flex items-center gap-1.5">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-champagne/80" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-champagne/80" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-champagne/80" />
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <div className="border-t hairline px-4 md:px-16 py-4 md:py-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3 glass rounded-full px-5 md:px-6 py-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Speak to the Guardian…" className="flex-1 min-w-0 bg-transparent outline-none text-platinum placeholder:text-platinum/30 text-sm" />
          <button onClick={send} disabled={sending || !input.trim()} className="shrink-0 w-10 h-10 rounded-full bg-champagne text-obsidian flex items-center justify-center disabled:opacity-30 hover:bg-champagne-soft transition"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function Community() {
  const [builders, setBuilders] = useState([]);
  useEffect(() => { fetch('/api/community').then(r => r.json()).then(d => setBuilders(d.builders || [])); }, []);
  return (
    <div className="px-6 md:px-16 py-10 md:py-16">
      <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80 mb-4">Witnesses</div>
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-platinum tracking-tight leading-[1.05]">A world <em className="text-gold-shimmer not-italic">walking.</em></h1>
      <p className="mt-4 text-platinum/50 text-base md:text-lg max-w-2xl">Not followers. Not likes. Only journeys, witnessed by others walking their own. Every Monument here was raised by a real person.</p>
      <div className="mt-12 md:mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {builders.map((b, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -4 }} className="glass rounded-xl p-6 cursor-default group">
            <div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-champagne/40 to-platinum/10 group-hover:from-champagne/60 transition-colors duration-500" /><div className="text-sm text-platinum">{b.name}</div></div>
            <div className="font-serif text-lg text-platinum/90 leading-tight line-clamp-3">{b.dream}</div>
            {b.values?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {b.values.slice(0, 3).map((v) => (<span key={v} className="text-[9px] tracking-[0.2em] uppercase text-champagne/70 px-2 py-0.5 rounded-full border border-champagne/15">{v}</span>))}
              </div>
            )}
            <div className="mt-4 text-[10px] tracking-widest uppercase text-platinum/30">Walking since {new Date(b.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</div>
          </motion.div>
        ))}
        {builders.length === 0 && (
          <div className="col-span-full">
            <div className="glass rounded-xl p-10 md:p-16 text-center max-w-2xl mx-auto">
              <div className="mx-auto w-12 h-12 rounded-full glass flex items-center justify-center border border-champagne/25 mb-6">
                <Users className="w-4 h-4 text-champagne" />
              </div>
              <div className="font-serif text-2xl md:text-3xl text-platinum/85 leading-tight">Yours will be the first Monument raised here.</div>
              <div className="mt-4 text-platinum/50 text-sm max-w-md mx-auto">Before you have followers. Before you have witnesses. There is only your journey — and someone quietly walking beside it.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Profile({ monument }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => { fetch(`/api/entries?monumentId=${monument.id}`).then(r => r.json()).then(d => setEntries(d.entries || [])); }, [monument.id]);
  const daysSince = Math.floor((Date.now() - new Date(monument.createdAt).getTime()) / 86400000) + 1;
  return (
    <div className="px-6 md:px-16 py-10 md:py-16 max-w-4xl">
      <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80 mb-4">A Personal Monument</div>
      <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl text-platinum tracking-tight leading-[1.05] break-words">{monument.name}</h1>

      <div className="mt-8 md:mt-10 glass rounded-xl p-6 md:p-8">
        <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-3">The story I am telling</div>
        <div className="font-serif text-2xl md:text-3xl text-platinum leading-tight">{monument.dream}</div>
        <div className="mt-4 text-xs text-platinum/40">Toward: {monument.timeframe}</div>
      </div>

      <div className="mt-6 glass rounded-xl p-6 md:p-8">
        <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-3">Why it must be told</div>
        <div className="text-platinum/80 leading-[1.85] text-[15px] md:text-base">{monument.purpose}</div>
      </div>

      <div className="mt-6 glass rounded-xl p-6 md:p-8">
        <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-4">Inscribed at the base</div>
        <div className="flex gap-2 md:gap-3 flex-wrap">
          {(monument.values || []).map((v) => (<div key={v} className="font-serif text-xl md:text-2xl text-champagne px-4 md:px-5 py-1.5 md:py-2 rounded-full border border-champagne/30">{v}</div>))}
        </div>
      </div>

      <div className="mt-14 md:mt-16 text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-6">The Monument in numbers</div>
      <div className="grid sm:grid-cols-3 gap-4 md:gap-6">
        <div className="glass rounded-xl p-6"><div className="text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-3">Days preserved</div><div className="font-serif text-4xl md:text-5xl text-platinum tabular">{daysSince}</div></div>
        <div className="glass rounded-xl p-6"><div className="text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-3">Stones inscribed</div><div className="font-serif text-4xl md:text-5xl text-platinum tabular">{entries.length}</div></div>
        <div className="glass rounded-xl p-6"><div className="text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-3">The horizon</div><div className="font-serif text-xl md:text-2xl text-platinum">{monument.timeframe}</div></div>
      </div>
    </div>
  );
}

function AuthModal({ mode: initialMode = 'signup', onSuccess, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getBrowserClient();
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) { setError(err.message); return; }
        if (!data.session) {
          setInfo('Account created. Check your email to confirm your address, then sign in.');
          setMode('login');
        } else {
          onSuccess();
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) { setError(err.message); return; }
        onSuccess();
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md mx-4 bg-[#0a0a0a] border hairline rounded-sm p-10 md:p-14"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-platinum/40 hover:text-platinum transition">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-1.5 h-1.5 rounded-full bg-champagne" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/70">Monument of Dreams</span>
        </div>

        <h2 className="font-serif text-3xl text-platinum mb-2">
          {mode === 'signup' ? 'Raise your monument.' : 'Return to your monument.'}
        </h2>
        <p className="text-platinum/40 text-sm mb-10">
          {mode === 'signup' ? 'Create an account to begin.' : 'Sign in to continue your story.'}
        </p>

        {info && <div className="mb-6 text-sm text-champagne/90 bg-champagne/10 border border-champagne/20 rounded px-4 py-3">{info}</div>}
        {error && <div className="mb-6 text-sm text-red-400/90 bg-red-900/20 border border-red-500/20 rounded px-4 py-3">{error}</div>}

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="text-[10px] tracking-[0.25em] uppercase text-platinum/50 block mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="bg-transparent border-0 border-b hairline-strong rounded-none focus-visible:ring-0 text-platinum placeholder:text-platinum/20 h-12 px-0"
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.25em] uppercase text-platinum/50 block mb-2">Password</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="bg-transparent border-0 border-b hairline-strong rounded-none focus-visible:ring-0 text-platinum placeholder:text-platinum/20 h-12 px-0"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full bg-white text-black text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-white/95 disabled:opacity-40 transition-all duration-500 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null); setInfo(null); }}
            className="text-[11px] tracking-wide text-platinum/40 hover:text-platinum/80 transition"
          >
            {mode === 'signup' ? 'Already have an account? Sign in.' : "Don't have an account? Sign up."}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Ambient />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-8"
      >
        <div className="relative w-20 h-20">
          <div className="absolute inset-[-40%] rounded-full pointer-events-none animate-atmosphere-breath"
               style={{ background: 'radial-gradient(circle, rgba(90,145,225,0.28) 40%, transparent 74%)' }} />
          <div className="relative w-full h-full rounded-full overflow-hidden animate-earthspin"
               style={{ boxShadow: '0 0 40px -5px rgba(88,140,220,0.4), inset 0 -4px 20px rgba(0,0,0,0.55)' }}>
            <img src="/earth.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scale(1.55)' }} draggable="false" />
          </div>
        </div>
        <div className="text-[10px] tracking-[0.4em] uppercase text-white/50">Monument of Dreams</div>
      </motion.div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('landing');
  const [monument, setMonument] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!user) {
      setMonument(null);
      setView('landing');
      setReady(true);
      return;
    }
    setReady(false);
    Promise.all([
      fetch(`/api/journeys/me?userId=${user.id}`).then(r => r.json()).catch(() => ({ monument: null })),
      fetch('/api/stats').then(r => r.json()).catch(() => null),
    ]).then(([m, s]) => {
      setStats(s);
      if (m.monument) { setMonument(m.monument); setView('home'); }
      else { setView('onboard'); }
      setReady(true);
    }).catch(() => { setView('onboard'); setReady(true); });
  }, [authChecked, user]);

  function handleBegin() {
    if (user) setView('onboard');
    else { setAuthMode('signup'); setShowAuth(true); }
  }

  function handleAuthSuccess() {
    setShowAuth(false);
  }

  async function handleLogout() {
    await getBrowserClient().auth.signOut();
    setUser(null);
    setMonument(null);
    setView('landing');
  }

  if (!authChecked || !ready) return <LoadingScreen />;

  return (
    <div className="min-h-screen grain">
      <Ambient />
      <AnimatePresence>
        {showAuth && (
          <AuthModal key="auth" mode={authMode} onSuccess={handleAuthSuccess} onClose={() => setShowAuth(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
            <Landing stats={stats} onBegin={handleBegin} onExplore={() => setView('community-preview')} onSignIn={() => { setAuthMode('login'); setShowAuth(true); }} />
          </motion.div>
        )}
        {view === 'community-preview' && (
          <motion.div key="cp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <div className="min-h-screen">
              <div className="px-6 md:px-8 py-6"><button onClick={() => setView('landing')} className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-platinum/50 hover:text-platinum transition">← Back</button></div>
              <Community />
              <div className="text-center py-16 px-6"><button onClick={handleBegin} className="px-8 py-4 rounded-full bg-champagne text-obsidian text-[10px] md:text-xs tracking-[0.2em] uppercase hover:bg-champagne-soft hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-15px_rgba(212,180,131,0.4)] active:translate-y-0 active:scale-[0.98] transition-all duration-500 gold-glow">Begin your own Monument</button></div>
            </div>
          </motion.div>
        )}
        {view === 'onboard' && (
          <motion.div key="ob" initial={{ opacity: 0, scale: 0.985, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.01, y: -8 }} transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}>
            <Onboard userId={user?.id} onDone={(m) => { setMonument(m); setView('home'); }} onCancel={() => setView('landing')} />
          </motion.div>
        )}
        {['home', 'timeline', 'mentor', 'community', 'profile'].includes(view) && monument && (
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <Shell view={view} setView={setView} monument={monument} onLogout={handleLogout}>
              {view === 'home' && <Home monument={monument} setView={setView} userId={user?.id} />}
              {view === 'timeline' && <Timeline monument={monument} userId={user?.id} />}
              {view === 'mentor' && <Mentor userId={user?.id} />}
              {view === 'community' && <Community />}
              {view === 'profile' && <Profile monument={monument} />}
            </Shell>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
