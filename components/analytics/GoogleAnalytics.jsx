'use client';

import Script from 'next/script';

// GA4 via next/script. The Measurement ID lives in NEXT_PUBLIC_GA_ID so it is
// inlined into the client bundle at build time; if the variable is absent
// (e.g. local dev without analytics, or a preview deploy) the component renders
// nothing and no gtag request is ever made. No consent banner yet — that is a
// deliberate launch-phase decision, to be revisited before the public launch.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      {/* The gtag loader. afterInteractive: it runs once the page is
          interactive, so it never competes with hydration or the LCP paint. */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      {/* Bootstraps dataLayer and fires the initial page_view config. */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
