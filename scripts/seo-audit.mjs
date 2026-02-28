#!/usr/bin/env node
/**
 * SEO Audit Script
 *
 * Checks the following for each configured URL:
 *  - HTTP status code
 *  - <title> tag presence and length
 *  - <meta name="description"> presence and length
 *  - <link rel="canonical"> presence
 *  - <meta property="og:*"> Open Graph tags
 *  - <meta name="twitter:*"> Twitter card tags
 *  - <h1> tag presence and count
 *  - JSON-LD structured data (WebSite, Organization, WebPage, WebApplication, FAQPage)
 *  - robots.txt accessibility
 *  - sitemap.xml accessibility
 *
 * Usage:
 *   node scripts/seo-audit.mjs
 *   node scripts/seo-audit.mjs --url https://example.com
 *
 * The script exits with code 1 if any CRITICAL check fails.
 */


// ── Configuration ──────────────────────────────────────────────────────────────

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'OrcaStream';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const PAGES_TO_AUDIT = [
    { path: '/', label: 'Homepage' },
    { path: '/live-sports', label: 'Live Sports' },
];

const SPECIAL_ROUTES = [
    { path: '/robots.txt', label: 'robots.txt' },
    { path: '/sitemap.xml', label: 'sitemap.xml' },
];

// ── ANSI Colors ────────────────────────────────────────────────────────────────

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

const pass = `${c.green}✓ PASS${c.reset}`;
const fail = `${c.red}✗ FAIL${c.reset}`;
const warn = `${c.yellow}⚠ WARN${c.reset}`;

let totalFails = 0;
let totalWarns = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Fetch a URL and return { status, html } with a 10-second timeout.
 * Returns null if the fetch fails (network error, timeout, etc.)
 */
async function fetchPage(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': `${SITE_NAME}-SEO-Auditor/1.0` },
        });
        const html = await res.text();
        return { status: res.status, html };
    } catch (err) {
        return { status: 0, error: String(err) };
    } finally {
        clearTimeout(timer);
    }
}

/** Extract first regex match from html, returns null if not found */
function extract(html, pattern) {
    const m = html.match(pattern);
    return m ? m[1] : null;
}


/** Count occurrences of a pattern in html */
function countMatches(html, pattern) {
    return (html.match(new RegExp(pattern, 'gi')) || []).length;
}

/**
 * Try to parse all JSON-LD scripts from an HTML page.
 * Returns an array of entity objects from the @graph (or the top-level entity).
 */
function parseJsonLd(html) {
    const scripts = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    const entities = [];
    for (const [, raw] of scripts) {
        try {
            const parsed = JSON.parse(raw.trim());
            if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
                entities.push(...parsed['@graph']);
            } else if (parsed['@type']) {
                entities.push(parsed);
            }
        } catch {
            // malformed JSON-LD — will be caught as a missing schema later
        }
    }
    return entities;
}

/** Print a single check result */
function check(label, status, detail = '') {
    const icon = status === 'pass' ? pass : status === 'warn' ? warn : fail;
    if (status === 'fail') totalFails++;
    if (status === 'warn') totalWarns++;
    const detailStr = detail ? ` ${c.gray}${detail}${c.reset}` : '';
    console.log(`  ${icon} ${label}${detailStr}`);
}

// ── Audit Functions ────────────────────────────────────────────────────────────

/** Audit a single page URL */
async function auditPage(url, label) {
    console.log(`\n${c.bold}${c.cyan}▶ ${label}${c.reset}  ${c.gray}${url}${c.reset}`);

    const result = await fetchPage(url);

    // ── HTTP Status ──
    if (!result || result.status === 0) {
        check('HTTP reachable', 'fail', result?.error ?? 'Fetch failed — is the dev server running?');
        return;
    }
    if (result.status !== 200) {
        check(`HTTP status ${result.status}`, 'fail', 'Expected 200 OK');
        return;
    }
    check(`HTTP 200 OK`, 'pass');

    const { html } = result;

    // ── <title> ──
    const title = extract(html, /<title[^>]*>([^<]+)<\/title>/i);
    if (!title) {
        check('<title>', 'fail', 'Missing');
    } else if (title.length < 30 || title.length > 70) {
        check('<title>', 'warn', `"${title}" (${title.length} chars — ideal: 30–70)`);
    } else {
        check('<title>', 'pass', `"${title}" (${title.length} chars)`);
    }

    // ── <meta description> ──
    const desc = extract(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
        || extract(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (!desc) {
        check('<meta description>', 'fail', 'Missing');
    } else if (desc.length < 120 || desc.length > 160) {
        check('<meta description>', 'warn', `${desc.length} chars — ideal: 120–160`);
    } else {
        check('<meta description>', 'pass', `${desc.length} chars`);
    }

    // ── Canonical ──
    const canonical = extract(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
        || extract(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    if (!canonical) {
        check('<link rel="canonical">', 'fail', 'Missing');
    } else {
        check('<link rel="canonical">', 'pass', canonical);
    }

    // ── Open Graph ──
    const ogTitle = extract(html, /property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const ogDesc = extract(html, /property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const ogUrl = extract(html, /property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
    const ogType = extract(html, /property=["']og:type["'][^>]+content=["']([^"']+)["']/i);
    check('og:title', ogTitle ? 'pass' : 'fail', ogTitle ?? 'Missing');
    check('og:description', ogDesc ? 'pass' : 'fail', ogDesc ? `${ogDesc.length} chars` : 'Missing');
    check('og:url', ogUrl ? 'pass' : 'fail', ogUrl ?? 'Missing');
    check('og:type', ogType ? 'pass' : 'fail', ogType ?? 'Missing');

    // ── Twitter Card ──
    const twCard = extract(html, /name=["']twitter:card["'][^>]+content=["']([^"']+)["']/i)
        || extract(html, /content=["']([^"']+)["'][^>]+name=["']twitter:card["']/i);
    check('twitter:card', twCard ? 'pass' : 'warn', twCard ?? 'Missing (recommended)');

    // ── H1 ──
    const h1Count = countMatches(html, '<h1[^>]*>');
    if (h1Count === 0) {
        check('<h1>', 'fail', 'Missing — exactly 1 required');
    } else if (h1Count > 1) {
        check('<h1>', 'fail', `Found ${h1Count} — must be exactly 1`);
    } else {
        const h1Text = extract(html, /<h1[^>]*>([^<]+)<\/h1>/i);
        check('<h1>', 'pass', h1Text ? `"${h1Text.trim()}"` : '');
    }

    // ── Structured Data (JSON-LD) ──
    const entities = parseJsonLd(html);
    const types = entities.map(e => e['@type']);

    const hasWebSite = types.includes('WebSite');
    const hasOrg = types.includes('Organization');
    const hasWebPage = types.includes('WebPage');
    const hasApp = types.includes('WebApplication') || types.includes('SoftwareApplication');
    const hasFAQ = types.includes('FAQPage');

    check('JSON-LD: WebSite', hasWebSite ? 'pass' : 'fail', hasWebSite ? '' : 'Missing — required globally');
    check('JSON-LD: Organization', hasOrg ? 'pass' : 'fail', hasOrg ? '' : 'Missing — required globally');
    check('JSON-LD: WebPage', hasWebPage ? 'pass' : 'fail', hasWebPage ? '' : 'Missing — required per page');
    check('JSON-LD: WebApplication', hasApp ? 'pass' : 'warn', hasApp ? '' : 'Missing — recommended for tool pages');
    check('JSON-LD: FAQPage', hasFAQ ? 'pass' : 'warn', hasFAQ ? '' : 'Missing — add if page has FAQ section');
}

/** Audit special routes (robots.txt, sitemap.xml) */
async function auditSpecialRoute(url, label) {
    console.log(`\n${c.bold}${c.cyan}▶ ${label}${c.reset}  ${c.gray}${url}${c.reset}`);
    const result = await fetchPage(url);
    if (!result || result.status === 0) {
        check('HTTP reachable', 'fail', result?.error ?? 'Fetch failed');
        return;
    }
    if (result.status !== 200) {
        check(`HTTP ${result.status}`, 'fail', 'Expected 200 OK');
        return;
    }
    check('HTTP 200 OK', 'pass');

    if (label === 'sitemap.xml') {
        const hasUrlset = result.html.includes('<urlset') || result.html.includes('<sitemapindex');
        check('XML structure', hasUrlset ? 'pass' : 'fail', hasUrlset ? '' : 'Missing <urlset> or <sitemapindex>');

        // Count URLs in sitemap
        const urlCount = countMatches(result.html, '<url>');
        if (urlCount > 0) {
            check(`URLs in sitemap (${urlCount})`, 'pass');
        } else {
            check('URLs in sitemap', 'warn', 'No <url> entries found');
        }
    }

    if (label === 'robots.txt') {
        const hasDisallow = result.html.toLowerCase().includes('disallow');
        const hasSitemap = result.html.toLowerCase().includes('sitemap');
        check('Disallow rules', hasDisallow ? 'pass' : 'warn', hasDisallow ? '' : 'No Disallow directives');
        check('Sitemap reference', hasSitemap ? 'pass' : 'warn', hasSitemap ? '' : 'No Sitemap: directive found');
    }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    // Allow override via CLI: node scripts/seo-audit.mjs --url https://example.com
    const args = process.argv.slice(2);
    const urlFlagIdx = args.indexOf('--url');
    const baseUrl = urlFlagIdx !== -1 ? args[urlFlagIdx + 1] : BASE_URL;

    console.log(`\n${c.bold}═══════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}  ${SITE_NAME} SEO Audit${c.reset}`);
    console.log(`  ${c.gray}Base URL: ${baseUrl}${c.reset}`);
    console.log(`  ${c.gray}Time:     ${new Date().toLocaleString('id-ID')}${c.reset}`);
    console.log(`${c.bold}═══════════════════════════════════════════════════${c.reset}`);

    for (const { path, label } of PAGES_TO_AUDIT) {
        await auditPage(`${baseUrl}${path}`, label);
    }

    for (const { path, label } of SPECIAL_ROUTES) {
        await auditSpecialRoute(`${baseUrl}${path}`, label);
    }

    // ── Summary ──
    console.log(`\n${c.bold}═══════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}  Summary${c.reset}`);
    console.log(`  ${totalFails > 0 ? c.red : c.gray}Critical failures: ${totalFails}${c.reset}`);
    console.log(`  ${totalWarns > 0 ? c.yellow : c.gray}Warnings:          ${totalWarns}${c.reset}`);
    console.log(`${c.bold}═══════════════════════════════════════════════════${c.reset}\n`);

    if (totalFails > 0) {
        console.log(`${c.red}${c.bold}❌ Audit FAILED — fix critical issues above.${c.reset}\n`);
        process.exit(1);
    } else if (totalWarns > 0) {
        console.log(`${c.yellow}${c.bold}⚠  Audit passed with warnings. Review items above.${c.reset}\n`);
    } else {
        console.log(`${c.green}${c.bold}✅ Audit PASSED — all checks OK!${c.reset}\n`);
    }
}

main();
