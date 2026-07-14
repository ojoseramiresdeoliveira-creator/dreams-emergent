'use client';

import { Sparkles } from 'lucide-react';

// The Guardian's ambient presence: a champagne halo breathing behind a glass
// sigil. Shared wherever the Guardian is "in the room" at rest — the Home
// reflection card, the Mentor. Two breath layers offset in phase so the glow
// never sits still. CSS-driven; the global reduced-motion rule freezes it.
export default function GuardianPresence({ size = 'sm', className = '' }) {
  const dim = { xs: 'w-6 h-6', sm: 'w-8 h-8', md: 'w-10 h-10' }[size] || 'w-8 h-8';
  const icon = { xs: 'w-3 h-3', sm: 'w-3.5 h-3.5', md: 'w-4 h-4' }[size] || 'w-3.5 h-3.5';
  return (
    <div className={`relative shrink-0 ${dim} ${className}`}>
      <span aria-hidden className="absolute inset-[-8px] rounded-full bg-champagne/10 blur-lg animate-atmosphere-breath" />
      <span aria-hidden className="absolute inset-[-3px] rounded-full bg-champagne/[0.07] blur-md animate-atmosphere-breath" style={{ animationDelay: '-4.5s' }} />
      <div className="relative w-full h-full rounded-full glass flex items-center justify-center border border-champagne/25">
        <Sparkles className={`${icon} text-champagne`} />
      </div>
    </div>
  );
}
