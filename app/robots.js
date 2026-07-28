export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // API routes return JSON/401, never indexable content — keep them out of
      // the crawl budget.
      disallow: '/api/',
    },
    sitemap: 'https://monumentofdreams.com/sitemap.xml',
  };
}
