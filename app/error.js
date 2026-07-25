'use client';

// Route-level error boundary for the app tree. Without it, a render throw
// anywhere in the (large, client-rendered) App component would unmount to a
// blank page. Here the user gets a calm, on-brand recovery screen instead:
// reset() re-renders the segment, and a hard reload is offered as a fallback.
// It renders inside the root layout, so the site's fonts and tokens apply.
import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian px-6">
      <div className="max-w-md text-center">
        <div className="eyebrow mb-6">Something interrupted</div>
        <h1 className="font-serif font-display text-4xl md:text-5xl text-platinum track-title leading-[1.05]">
          The stone slipped.
        </h1>
        <p className="mt-5 text-platinum-muted text-base leading-[1.7]">
          This was a problem showing the page, not with your journey — nothing was lost. Try again, or reload if it persists.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="btn-premium btn-solid w-full sm:w-auto px-10 py-4 rounded-full text-[11px] tracking-[0.24em] uppercase font-medium"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="btn-premium btn-outline w-full sm:w-auto px-10 py-4 rounded-full text-[11px] tracking-[0.24em] uppercase"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
