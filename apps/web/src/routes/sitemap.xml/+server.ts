/**
 * Dynamic Sitemap Generator
 */

import type { RequestHandler } from './$types';
import { getCacheHeaders, generateETag, checkConditional } from '$lib/utils/cache';

const SITE_URL = 'https://guillochestudio.com';

const staticPages = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/studio', priority: 0.9, changefreq: 'weekly' },
  { path: '/marketplace', priority: 0.8, changefreq: 'daily' },
  { path: '/pricing', priority: 0.7, changefreq: 'monthly' },
  { path: '/about', priority: 0.5, changefreq: 'monthly' },
  { path: '/docs', priority: 0.6, changefreq: 'weekly' },
  { path: '/blog', priority: 0.6, changefreq: 'weekly' },
];

export const GET: RequestHandler = async ({ locals }) => {
  const lastmod = new Date().toISOString().split('T')[0];

  // Start with static pages
  let urls = staticPages.map(
    (page) => `
  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  );

  // Add public patterns from marketplace
  try {
    if (locals.supabase) {
      const { data: patterns } = await locals.supabase
        .from('patterns')
        .select('id, updated_at')
        .eq('is_public', true)
        .eq('is_listed', true)
        .order('updated_at', { ascending: false })
        .limit(1000);

      if (patterns) {
        const patternUrls = patterns.map(
          (pattern) => `
  <url>
    <loc>${SITE_URL}/marketplace/${pattern.id}</loc>
    <lastmod>${new Date(pattern.updated_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`
        );
        urls = [...urls, ...patternUrls];
      }
    }
  } catch (error) {
    console.error('Error fetching patterns for sitemap:', error);
  }

  // Add public DNA links
  try {
    if (locals.supabase) {
      const { data: dnaLinks } = await locals.supabase
        .from('pattern_dna')
        .select('short_code, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (dnaLinks) {
        const dnaUrls = dnaLinks.map(
          (dna) => `
  <url>
    <loc>${SITE_URL}/dna/${dna.short_code}</loc>
    <lastmod>${new Date(dna.created_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.3</priority>
  </url>`
        );
        urls = [...urls, ...dnaUrls];
      }
    }
  } catch (error) {
    console.error('Error fetching DNA links for sitemap:', error);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls.join('')}
</urlset>`;

  const sitemapContent = sitemap.trim();
  const etag = generateETag(sitemapContent);

  // Check for conditional request
  const conditionalResponse = checkConditional(
    new Request('http://localhost', { headers: { 'If-None-Match': '' } }),
    etag
  );
  if (conditionalResponse) return conditionalResponse;

  return new Response(sitemapContent, {
    headers: {
      'Content-Type': 'application/xml',
      'ETag': etag,
      ...getCacheHeaders('SITEMAP'),
    },
  });
};
