import { NextResponse } from 'next/server';

// Old-concept URLs that no longer exist (quotes "doses", the old dream wall,
// dream-meaning pages, category hubs). No new equivalent exists, so we return
// 410 Gone — this tells Google to drop them from the index faster than a plain
// 404, which it would keep retrying for months. See Search Console 404 report
// (17 URLs, 2026-07-28).
const GONE_PREFIXES = ['/dose/', '/dream/', '/dreams/', '/category/'];
const GONE_EXACT = ['/dreams-that-come-true', '/dream-meanings'];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const isGone =
    GONE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    GONE_EXACT.includes(pathname);

  if (isGone) {
    return new NextResponse(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>410 Gone</title></head><body><h1>410 Gone</h1><p>This page no longer exists.</p></body></html>',
      { status: 410, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
