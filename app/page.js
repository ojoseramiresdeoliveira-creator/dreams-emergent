'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import {
  ArrowRight, ArrowUpRight, Sparkles, Feather, Flame, Mountain,
  MessageSquare, Send, Plus, Users, Home as HomeIcon,
  History, User, ChevronRight, Check, Loader2, Star, Trophy, RotateCcw,
  Circle, Menu, X
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/* ============ Helpers ============ */
function getUserId() {
  if (typeof window === 'undefined') return null;
  let uid = localStorage.getItem('mod_uid');
  if (!uid) { uid = uuidv4(); localStorage.setItem('mod_uid', uid); }
  return uid;
}

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

function Landing({ onBegin, onExplore, stats }) {
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
            <a href="#ethos" className="hover:text-white transition-colors duration-500">Ethos</a>
            <a href="#how" className="hover:text-white transition-colors duration-500">Method</a>
            <a href="#world" className="hover:text-white transition-colors duration-500">Live</a>
            <a href="#mentor" className="hover:text-white transition-colors duration-500">Mentor</a>
            <a href="#premium" className="hover:text-white transition-colors duration-500">Eternal</a>
          </div>
          <button onClick={onBegin} className="text-[10px] md:text-[11px] tracking-[0.24em] uppercase text-white/80 hover:text-white transition-colors duration-500 flex items-center gap-2">
            Enter <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </nav>

      {/* HERO — Earth rotating on left, text on right */}
      <section className="relative min-h-[100svh] overflow-hidden flex items-center justify-center bg-black">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(20,35,75,0.25),transparent_65%)]" />
          <div className="absolute inset-0 dot-field opacity-30" />
          <div className="absolute inset-0 vignette" />
        </div>

        <div className="relative w-full max-w-[1400px] mx-auto px-6 md:px-14 pt-28 md:pt-24 pb-20 md:pb-0 grid md:grid-cols-2 gap-14 md:gap-4 items-center">
          {/* Earth */}
          <motion.div
            style={{ y: heroY }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center md:justify-start order-1"
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
                className="group w-full sm:w-auto whitespace-nowrap px-8 md:px-10 py-4 rounded-full bg-white text-black text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-white/95 transition-all duration-500 flex items-center justify-center gap-3"
              >
                Create My Monument
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-500" />
              </button>
              <button
                onClick={onExplore}
                className="w-full sm:w-auto whitespace-nowrap px-8 md:px-10 py-4 rounded-full border border-white/15 text-[11px] tracking-[0.24em] uppercase text-white/80 hover:text-white hover:border-white/40 transition-all duration-500"
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
            The Mission
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }} className="font-serif text-[42px] md:text-[72px] leading-[1.08] tracking-[-0.02em] text-white">
            We help people become<br />
            <span className="italic text-white/85">who they dream of becoming.</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 2, delay: 0.5 }} className="mt-14 text-white/55 text-base md:text-lg font-light leading-[2] max-w-2xl mx-auto">
            The world celebrates results. We preserve the journey. Every step you take — every quiet victory, every honest failure — is placed forever into a monument only you can build.
          </motion.p>
        </div>
      </SectionCinematic>

      {/* METHOD */}
      <section id="how" className="relative bg-black">
        <div className="max-w-[1200px] mx-auto px-8 md:px-14 py-40 md:py-56">
          <div className="grid md:grid-cols-2 gap-20 items-end mb-32">
            <div>
              <div className="text-[10px] tracking-[0.4em] uppercase text-white/40 mb-10">The Method</div>
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
              { n: '01', t: 'Choose your Dream', d: 'Declare what you are here to become. Not a task list. A north star that will outlast every bad day.', img: 'https://images.pexels.com/photos/2102546/pexels-photo-2102546.jpeg?auto=compress&cs=tinysrgb&w=1800' },
              { n: '02', t: 'Build your Journey', d: 'Every reflection, victory, failure and restart becomes a permanent brick in the wall. Nothing disappears.', img: 'https://images.unsplash.com/photo-1468322638156-074863f9362e?auto=format&fit=crop&w=1800&q=85' },
              { n: '03', t: 'Leave your Monument', d: 'A living museum of your becoming, curated by an intelligence that has been paying attention for years.', img: 'https://images.pexels.com/photos/16827297/pexels-photo-16827297.jpeg?auto=compress&cs=tinysrgb&w=1800' },
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
            The world is <span className="italic text-white/80">building.</span>
          </h2>
          <p className="mt-10 text-white/55 text-[16px] font-light max-w-xl leading-[1.85]">
            Real dreams. Real people. Preserved in a living monument, in real time.
          </p>

          <div className="mt-28 grid md:grid-cols-4 gap-12 md:gap-8">
            {[
              { label: 'Dreams created', value: stats?.dreamsCreated ?? 12847 },
              { label: 'Completed today', value: stats?.dreamsCompletedToday ?? 342 },
              { label: 'Builders online', value: stats?.buildersOnline ?? 1247 },
              { label: 'Countries', value: stats?.countries ?? 96 },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 1.4, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="font-serif text-[56px] md:text-[76px] text-white leading-none tracking-[-0.03em]">
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
            <div className="text-[10px] tracking-[0.4em] uppercase text-champagne/70 mb-10">Monument Mentor</div>
            <h2 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-white">
              A mentor who <span className="italic text-white/70">remembers.</span>
            </h2>
            <p className="mt-10 text-white/55 text-[16px] leading-[1.95] font-light max-w-lg">
              Not a chatbot. The Monument Mentor knows your dream, your patterns, your relapses and your victories. It speaks with the calm of a curator and the precision of a friend who has been paying attention for years.
            </p>
            <div className="mt-14 space-y-5 max-w-md">
              {['Reflects on your actual entries', 'Names the patterns you cannot see', 'Gives one specific next step', 'Remembers forever'].map((f) => (
                <div key={f} className="flex items-start gap-4 text-white/70">
                  <div className="mt-2.5 w-1 h-1 rounded-full bg-champagne shrink-0" />
                  <span className="text-[15px] font-light leading-relaxed">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }} className="md:col-span-6">
            <div className="relative border border-white/8 bg-[#0a0a0a] p-10 md:p-14">
              <div className="text-[10px] tracking-[0.35em] uppercase text-white/40 mb-8">Session · Sunday, 07:14</div>
              <div className="font-serif text-[22px] md:text-[28px] leading-[1.4] text-white/90">
                &ldquo;I see three restarts this month around the same block. This is not weakness. It is a signal. The dream is asking for a smaller commitment, not a bigger one. Try twelve minutes tomorrow. Only twelve.&rdquo;
              </div>
              <div className="mt-12 pt-6 border-t border-white/8 flex items-center justify-between">
                <div className="text-[10px] tracking-[0.32em] uppercase text-white/45">Monument Mentor</div>
                <div className="text-[10px] tracking-wider text-white/25">preserved forever</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PREMIUM */}
      <section id="premium" className="relative bg-black border-t border-white/5">
        <div className="max-w-[1200px] mx-auto px-8 md:px-14 py-40 md:py-56">
          <div className="max-w-2xl mb-28">
            <div className="text-[10px] tracking-[0.4em] uppercase text-white/40 mb-10">Monument Eternal</div>
            <h2 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-white">
              For those who <span className="italic text-white/70">refuse to disappear.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-12 gap-16 md:gap-20 items-start">
            <div className="md:col-span-5 space-y-0">
              {['Unlimited Monument', 'Monument AI Mentor', 'Yearly Life Book, printed', 'Timeline forever', 'Life Chapters', 'Time Capsules', 'Journey Export'].map((f) => (
                <div key={f} className="flex items-center gap-4 border-b border-white/6 py-5">
                  <Check className="w-3 h-3 text-champagne shrink-0" strokeWidth={2.5} />
                  <span className="text-white/80 text-[15px] font-light">{f}</span>
                </div>
              ))}
            </div>
            <div className="md:col-span-6 md:col-start-7">
              <div className="border border-white/10 p-10 md:p-14 bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex items-baseline justify-between mb-10">
                  <div>
                    <div className="text-[10px] tracking-[0.4em] uppercase text-champagne mb-4">Eternal</div>
                    <div className="text-white/55 text-[13px] font-light">Monthly · billed yearly</div>
                  </div>
                  <div className="font-serif text-[72px] md:text-[88px] text-white leading-none tracking-[-0.03em]">$12</div>
                </div>
                <p className="text-white/50 text-[15px] font-light leading-[1.95] max-w-md mb-12">
                  A single, quiet subscription. No tiers. No ads. No noise. Only the monument, in the highest resolution we can render a human life.
                </p>
                <button onClick={onBegin} className="group w-full py-4 rounded-full bg-white text-black text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-white/95 transition-all duration-500 flex items-center justify-center gap-3">
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
            Your life<br />
            <span className="italic text-white/85">is moving.</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 2, delay: 0.4 }} className="mt-12 text-white/55 text-[16px] font-light tracking-wide">
            Let it leave a monument.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, delay: 0.7 }}
            onClick={onBegin}
            className="mt-16 group px-12 py-5 rounded-full bg-white text-black text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-white/95 transition-all duration-500 inline-flex items-center gap-3"
          >
            Begin
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-500" />
          </motion.button>
        </div>
      </SectionCinematic>

      {/* FOOTER */}
      <footer className="bg-black border-t border-white/5">
        <div className="max-w-[1200px] mx-auto px-8 md:px-14 py-14 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-champagne" />
            <span className="text-[11px] tracking-[0.3em] uppercase text-white/70">Monument of Dreams</span>
          </div>
          <div className="text-[10px] tracking-[0.35em] uppercase text-white/30">MMXXV · Every journey preserved</div>
        </div>
      </footer>
    </div>
  );
}

function Onboard({ onDone, onCancel }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [dream, setDream] = useState('');
  const [purpose, setPurpose] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [values, setValues] = useState([]);
  const [saving, setSaving] = useState(false);
  const VALUE_OPTIONS = ['Discipline', 'Freedom', 'Craft', 'Legacy', 'Love', 'Truth', 'Adventure', 'Mastery', 'Health', 'Impact'];

  const steps = [
    { q: 'What do we call the builder?', hint: 'Your first name is enough.', input: (
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="bg-transparent border-0 border-b hairline-strong rounded-none text-4xl md:text-5xl font-serif h-20 focus-visible:ring-0 px-0 text-platinum placeholder:text-platinum/20" />
    ), canNext: name.trim().length > 0 },
    { q: 'What is the dream?', hint: 'One sentence. The one you are afraid to say out loud.', input: (
      <Textarea autoFocus value={dream} onChange={(e) => setDream(e.target.value)} placeholder="I dream of…" className="bg-transparent border-0 border-b hairline-strong rounded-none text-3xl md:text-4xl font-serif focus-visible:ring-0 px-0 text-platinum placeholder:text-platinum/20 min-h-[120px] resize-none leading-tight" />
    ), canNext: dream.trim().length > 4 },
    { q: 'Why this dream? Why you?', hint: 'The reason that would survive a bad day.', input: (
      <Textarea autoFocus value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Because…" className="bg-transparent border-0 border-b hairline-strong rounded-none text-2xl md:text-3xl font-serif focus-visible:ring-0 px-0 text-platinum placeholder:text-platinum/20 min-h-[120px] resize-none" />
    ), canNext: purpose.trim().length > 3 },
    { q: 'By when?', hint: 'A date, a season, a chapter of life.', input: (
      <Input autoFocus value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="e.g. by 2028, before I turn 30, this decade" className="bg-transparent border-0 border-b hairline-strong rounded-none text-2xl md:text-3xl font-serif focus-visible:ring-0 px-0 text-platinum placeholder:text-platinum/20 h-16" />
    ), canNext: timeframe.trim().length > 0 },
    { q: 'What values guide the build?', hint: 'Pick three. These become inscriptions on the monument.', input: (
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
    setSaving(true);
    try {
      const uid = getUserId();
      const res = await fetch('/api/monuments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, name, dream, purpose, timeframe, values }) });
      const data = await res.json();
      if (data.monument) { toast.success('Monument raised.'); onDone(data.monument); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="absolute top-0 inset-x-0 px-6 md:px-8 py-5 md:py-6 flex justify-between items-center z-10">
        <button onClick={onCancel} className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-platinum/40 hover:text-platinum transition">← Back</button>
        <div className="flex gap-1.5 md:gap-2">
          {steps.map((_, i) => (<div key={i} className={`w-6 md:w-8 h-px transition ${i <= step ? 'bg-champagne' : 'bg-platinum/15'}`} />))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 md:px-8 pt-20 pb-10">
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

function Shell({ view, setView, children, monument }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { k: 'home', label: 'Home', icon: HomeIcon },
    { k: 'timeline', label: 'Monument', icon: History },
    { k: 'mentor', label: 'Mentor', icon: MessageSquare },
    { k: 'community', label: 'Community', icon: Users },
    { k: 'profile', label: 'Profile', icon: User },
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
                    <div className="text-[9px] tracking-[0.3em] uppercase text-champagne/70 mb-2">Dream</div>
                    <div className="text-sm text-white/80 leading-relaxed line-clamp-3">{monument.dream}</div>
                  </div>
                )}
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
              <div className="text-[9px] tracking-[0.3em] uppercase text-champagne/70 mb-2">Dream</div>
              <div className="text-xs text-platinum/80 leading-relaxed line-clamp-3">{monument.dream}</div>
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 min-w-0 w-full">{children}</main>
    </div>
  );
}

function Home({ monument, setView }) {
  const [insight, setInsight] = useState(null);
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    const uid = getUserId();
    fetch(`/api/insight?userId=${uid}`).then(r => r.json()).then(d => setInsight(d));
    fetch(`/api/entries?monumentId=${monument.id}`).then(r => r.json()).then(d => setEntries(d.entries || []));
  }, [monument.id]);
  const daysSince = Math.floor((Date.now() - new Date(monument.createdAt).getTime()) / 86400000) + 1;
  return (
    <div className="px-6 md:px-16 py-10 md:py-16 max-w-6xl">
      <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80 mb-4">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-platinum tracking-tight leading-[1.05]">Welcome back, <em className="text-gold-shimmer not-italic">{monument.name}</em>.</h1>
      <p className="mt-4 text-platinum/50 text-base md:text-lg">Day {daysSince} of your monument.</p>
      <div className="mt-10 md:mt-16 grid sm:grid-cols-3 gap-4 md:gap-6">
        <div className="glass rounded-xl p-6">
          <div className="text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-3">Today&apos;s progress</div>
          <div className="font-serif text-4xl text-platinum">{entries.length}</div>
          <div className="text-xs text-platinum/50 mt-1">bricks laid</div>
        </div>
        <div className="glass rounded-xl p-6 sm:col-span-2">
          <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-3">Your Dream</div>
          <div className="font-serif text-xl md:text-2xl text-platinum leading-tight">{monument.dream}</div>
          <div className="mt-3 text-xs text-platinum/40">By {monument.timeframe}</div>
        </div>
      </div>
      <div className="mt-6 glass rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-champagne" />
          <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70">Monument AI · Today&apos;s insight</div>
        </div>
        {insight?.insight ? (
          <div className="space-y-3">
            {insight.insight.map((s, i) => (<div key={i} className="text-platinum/80 leading-relaxed font-light text-[15px] md:text-base">{s}</div>))}
          </div>
        ) : <div className="text-platinum/40 text-sm">Loading reflection…</div>}
        <button onClick={() => setView('mentor')} className="mt-6 text-xs tracking-[0.2em] uppercase text-champagne hover:text-champagne-soft transition flex items-center gap-2">Ask the Mentor <ArrowRight className="w-3 h-3" /></button>
      </div>
      <div className="mt-14 md:mt-16 flex items-end justify-between">
        <h2 className="font-serif text-2xl md:text-3xl text-platinum">Next step</h2>
        <button onClick={() => setView('timeline')} className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-platinum/50 hover:text-platinum">Open Monument →</button>
      </div>
      <div className="mt-6 glass rounded-xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="text-platinum/80 leading-relaxed text-[15px] md:text-base">Lay a new brick. Reflection, victory, failure or restart — every act preserves the journey.</div>
        <button onClick={() => setView('timeline')} className="shrink-0 px-6 py-3 rounded-full bg-platinum text-obsidian text-[10px] md:text-xs tracking-[0.2em] uppercase hover:bg-white transition flex items-center gap-2"><Plus className="w-3 h-3" /> Add</button>
      </div>
    </div>
  );
}

function Timeline({ monument }) {
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
    const r = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monumentId: monument.id, userId: getUserId(), type, title, content }) });
    const d = await r.json();
    if (d.entry) { toast.success('Preserved.'); setContent(''); setTitle(''); setAdding(false); await load(); }
    setSaving(false);
  }
  return (
    <div className="px-6 md:px-16 py-10 md:py-16 max-w-4xl">
      <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80 mb-4">The Monument</div>
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-platinum tracking-tight leading-[1.05]">{monument.name}&apos;s Monument</h1>
      <p className="mt-4 text-platinum/50 text-base md:text-lg leading-relaxed max-w-2xl">{monument.dream}</p>
      <div className="mt-4 flex gap-2 flex-wrap">
        {(monument.values || []).map((v) => (<span key={v} className="text-[10px] tracking-[0.2em] uppercase text-champagne/80 px-3 py-1 rounded-full border border-champagne/20">{v}</span>))}
      </div>
      <div className="mt-12">
        {!adding ? (
          <button onClick={() => setAdding(true)} className="w-full glass rounded-xl p-6 text-left hover:border-champagne/30 transition group">
            <div className="flex items-center gap-3 text-platinum/50 group-hover:text-platinum transition"><Plus className="w-4 h-4" /><span className="text-sm">Preserve a moment</span></div>
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-8 space-y-6">
            <div className="flex flex-wrap gap-2">
              {ENTRY_TYPES.map((t) => {
                const Icon = t.icon; const active = type === t.key;
                return (<button key={t.key} onClick={() => setType(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs tracking-wider transition border ${active ? 'bg-champagne/15 border-champagne/50 text-champagne' : 'hairline text-platinum/60 hover:text-platinum'}`}><Icon className="w-3 h-3" /> {t.label}</button>);
              })}
            </div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="bg-transparent border-0 border-b hairline rounded-none text-2xl font-serif h-14 px-0 focus-visible:ring-0 text-platinum placeholder:text-platinum/20" />
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What happened. What it means." className="bg-transparent border hairline rounded-lg text-base focus-visible:ring-1 focus-visible:ring-champagne/40 text-platinum placeholder:text-platinum/20 min-h-[140px]" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setAdding(false)} className="px-6 py-2.5 text-xs tracking-[0.2em] uppercase text-platinum/50 hover:text-platinum">Cancel</button>
              <button disabled={saving || !content.trim()} onClick={save} className="px-6 py-2.5 rounded-full bg-champagne text-obsidian text-xs tracking-[0.2em] uppercase disabled:opacity-30 hover:bg-champagne-soft transition flex items-center gap-2">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Preserve
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
              <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: i * 0.05 }} className="relative">
                <div className="absolute -left-10 md:-left-12 top-1 w-7 h-7 md:w-8 md:h-8 rounded-full glass flex items-center justify-center border border-champagne/20"><Icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-champagne" /></div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-2">{t.label} · {new Date(e.createdAt).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                {e.title && <div className="font-serif text-xl md:text-2xl text-platinum mb-2 leading-tight">{e.title}</div>}
                <div className="text-platinum/70 leading-relaxed font-light whitespace-pre-wrap text-[15px] md:text-base">{e.content}</div>
              </motion.div>
            );
          })}
          {entries.length === 0 && (<div className="text-platinum/40 text-sm">The monument awaits its first inscription.</div>)}
        </div>
      </div>
    </div>
  );
}

function Mentor() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => {
    const uid = getUserId();
    fetch(`/api/mentor/history?userId=${uid}`).then(r => r.json()).then(d => setMessages(d.messages || []));
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  async function send() {
    if (!input.trim()) return;
    const uid = getUserId(); const msg = input.trim(); setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg, createdAt: new Date().toISOString() }]);
    setSending(true);
    try {
      const r = await fetch('/api/mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, message: msg }) });
      const d = await r.json();
      setMessages((m) => [...m, { role: 'assistant', content: d.reply, createdAt: new Date().toISOString() }]);
      if (d.usedFallback) toast.warning('Mentor is thinking in reserve mode.');
    } catch { toast.error('Could not reach the Mentor.'); } finally { setSending(false); }
  }
  const starters = ['Reflect on my last week.', 'What pattern do you see in my journey?', 'Give me one honest next step.', 'I feel stuck. Where should I look?'];
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <div className="px-6 md:px-16 py-6 md:py-8 border-b hairline">
        <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80">Monument Mentor</div>
        <div className="font-serif text-2xl md:text-3xl text-platinum mt-1">A conversation, preserved.</div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 md:px-16 py-8 md:py-10">
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
          {messages.length === 0 && (
            <div className="space-y-6">
              <div className="text-platinum/60 leading-relaxed max-w-xl text-[15px] md:text-base">I have been reading your monument. Ask me anything about the journey. I remember all of it.</div>
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (<button key={s} onClick={() => setInput(s)} className="text-xs px-4 py-2 rounded-full glass hover:border-champagne/40 transition text-platinum/70">{s}</button>))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[80%] ${m.role === 'user' ? 'glass px-4 md:px-5 py-3 rounded-2xl rounded-br-md text-platinum' : ''}`}>
                {m.role === 'assistant' && (<div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-2">Mentor</div>)}
                <div className={`leading-relaxed ${m.role === 'assistant' ? 'font-serif text-lg md:text-xl text-platinum/90' : 'text-sm'}`}>{m.content}</div>
              </div>
            </motion.div>
          ))}
          {sending && (<div className="flex items-center gap-3 text-platinum/40 text-sm"><Loader2 className="w-3 h-3 animate-spin" /> the mentor is reflecting…</div>)}
        </div>
      </div>
      <div className="border-t hairline px-4 md:px-16 py-4 md:py-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3 glass rounded-full px-5 md:px-6 py-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Speak to the Mentor…" className="flex-1 min-w-0 bg-transparent outline-none text-platinum placeholder:text-platinum/30 text-sm" />
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
      <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80 mb-4">The Builders</div>
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-platinum tracking-tight leading-[1.05]">A world <em className="text-gold-shimmer not-italic">becoming</em>.</h1>
      <p className="mt-4 text-platinum/50 text-base md:text-lg max-w-2xl">Not followers. Not likes. Only people, dreams, and the journeys they are laying down.</p>
      <div className="mt-12 md:mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {builders.map((b, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-6 hover:border-champagne/30 transition cursor-default">
            <div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-champagne/40 to-platinum/10" /><div className="text-sm text-platinum">{b.name}</div></div>
            <div className="font-serif text-lg text-platinum/90 leading-tight line-clamp-3">{b.dream}</div>
            {b.values?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {b.values.slice(0, 3).map((v) => (<span key={v} className="text-[9px] tracking-[0.2em] uppercase text-champagne/70 px-2 py-0.5 rounded-full border border-champagne/15">{v}</span>))}
              </div>
            )}
            <div className="mt-4 text-[10px] tracking-widest uppercase text-platinum/30">Building since {new Date(b.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</div>
          </motion.div>
        ))}
        {builders.length === 0 && (<div className="text-platinum/40 col-span-full text-sm">The first monuments are being raised.</div>)}
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
      <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-champagne/80 mb-4">Personal Monument</div>
      <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl text-platinum tracking-tight leading-[1.05] break-words">{monument.name}</h1>
      <div className="mt-12 md:mt-16 grid sm:grid-cols-3 gap-4 md:gap-6">
        <div className="glass rounded-xl p-6"><div className="text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-3">Days Building</div><div className="font-serif text-4xl md:text-5xl text-platinum">{daysSince}</div></div>
        <div className="glass rounded-xl p-6"><div className="text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-3">Bricks Laid</div><div className="font-serif text-4xl md:text-5xl text-platinum">{entries.length}</div></div>
        <div className="glass rounded-xl p-6"><div className="text-[10px] tracking-[0.3em] uppercase text-platinum/40 mb-3">Timeframe</div><div className="font-serif text-xl md:text-2xl text-platinum">{monument.timeframe}</div></div>
      </div>
      <div className="mt-8 md:mt-10 glass rounded-xl p-6 md:p-8"><div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-3">The Dream</div><div className="font-serif text-2xl md:text-3xl text-platinum leading-tight">{monument.dream}</div></div>
      <div className="mt-6 glass rounded-xl p-6 md:p-8"><div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-3">Purpose</div><div className="text-platinum/80 leading-relaxed text-[15px] md:text-base">{monument.purpose}</div></div>
      <div className="mt-6 glass rounded-xl p-6 md:p-8">
        <div className="text-[10px] tracking-[0.3em] uppercase text-champagne/70 mb-4">Values inscribed</div>
        <div className="flex gap-2 md:gap-3 flex-wrap">
          {(monument.values || []).map((v) => (<div key={v} className="font-serif text-xl md:text-2xl text-champagne px-4 md:px-5 py-1.5 md:py-2 rounded-full border border-champagne/30">{v}</div>))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('landing');
  const [monument, setMonument] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const uid = getUserId();
    Promise.all([
      fetch(`/api/monuments/me?userId=${uid}`).then(r => r.json()),
      fetch(`/api/stats`).then(r => r.json()),
    ]).then(([m, s]) => { setStats(s); if (m.monument) { setMonument(m.monument); setView('home'); } setReady(true); }).catch(() => setReady(true));
  }, []);
  if (!ready) {
    return (<div className="min-h-screen flex items-center justify-center"><Ambient /><Loader2 className="w-5 h-5 animate-spin text-champagne" /></div>);
  }
  return (
    <div className="min-h-screen grain">
      <Ambient />
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
            <Landing stats={stats} onBegin={() => setView('onboard')} onExplore={() => setView('community-preview')} />
          </motion.div>
        )}
        {view === 'community-preview' && (
          <motion.div key="cp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <div className="min-h-screen">
              <div className="px-8 py-6"><button onClick={() => setView('landing')} className="text-xs tracking-[0.2em] uppercase text-platinum/50 hover:text-platinum">← Back</button></div>
              <Community />
              <div className="text-center py-16"><button onClick={() => setView('onboard')} className="px-8 py-4 rounded-full bg-champagne text-obsidian text-xs tracking-[0.2em] uppercase hover:bg-champagne-soft transition gold-glow">Join · Create My Monument</button></div>
            </div>
          </motion.div>
        )}
        {view === 'onboard' && (
          <motion.div key="ob" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <Onboard onDone={(m) => { setMonument(m); setView('home'); }} onCancel={() => setView('landing')} />
          </motion.div>
        )}
        {['home', 'timeline', 'mentor', 'community', 'profile'].includes(view) && monument && (
          <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <Shell view={view} setView={setView} monument={monument}>
              {view === 'home' && <Home monument={monument} setView={setView} />}
              {view === 'timeline' && <Timeline monument={monument} />}
              {view === 'mentor' && <Mentor />}
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
