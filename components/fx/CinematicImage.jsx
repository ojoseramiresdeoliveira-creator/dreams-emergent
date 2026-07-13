'use client';

import { useState } from 'react';

// Blur-up treatment for cinematic stills: a champagne-washed placeholder sits
// under the image and the still crossfades in once decoded — no raw pop-in
// from remote hotlinks. Opacity-only, so it stays compositor-friendly.
export default function CinematicImage({
  src,
  srcSet,
  sizes,
  alt = '',
  className = '',
  imgClassName = '',
  eager = false,
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        aria-hidden
        className={`absolute inset-0 transition-opacity [transition-duration:1400ms] ease-out ${loaded ? 'opacity-0' : 'opacity-100'}`}
        style={{
          background:
            'radial-gradient(120% 80% at 30% 20%, rgba(212,176,106,0.07), transparent 60%), linear-gradient(180deg, #0c0c0f 0%, #08080a 100%)',
        }}
      />
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity [transition-duration:1600ms] ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
      />
    </div>
  );
}
