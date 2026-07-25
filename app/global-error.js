'use client';

// Last-resort boundary: catches errors thrown in the root layout itself, which
// app/error.js cannot. It replaces the whole document, so it must render its
// own <html>/<body> and cannot rely on the layout's fonts or globals.css —
// hence the inline styles. A rare path (the layout is trivial), but it means
// the app never falls back to a blank white screen.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0A0B',
          color: '#F5F5F3',
          fontFamily: 'system-ui, sans-serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#A8A49A', lineHeight: 1.7, marginTop: '1rem' }}>
            The page failed to load. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '2rem',
              padding: '14px 40px',
              borderRadius: '999px',
              background: '#F5F5F3',
              color: '#0A0A0B',
              border: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.24em',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
