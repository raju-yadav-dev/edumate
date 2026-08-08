const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const SitemapCrawler = require('../SitemapCrawler');

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

test('SitemapCrawler recursively expands sitemap indexes into page URLs', async () => {
    const server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
        if (pathname === '/robots.txt') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('User-agent: *\nSitemap: http://127.0.0.1/sitemap_index.xml\n');
            return;
        }
        if (pathname === '/sitemap_index.xml') {
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end(`<?xml version="1.0" encoding="UTF-8"?>
                <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                    <sitemap><loc>http://127.0.0.1/sitemap-pages.xml</loc></sitemap>
                </sitemapindex>`);
            return;
        }
        if (pathname === '/sitemap-pages.xml') {
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end(`<?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                    <url><loc>http://127.0.0.1/page-a</loc></url>
                    <url><loc>http://127.0.0.1/page-b</loc></url>
                </urlset>`);
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>ok</body></html>');
    });

    await listen(server);
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    server.removeAllListeners('request');
    server.on('request', (req, res) => {
        const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
        if (pathname === '/robots.txt') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`User-agent: *\nSitemap: ${baseUrl}/sitemap_index.xml\n`);
            return;
        }
        if (pathname === '/sitemap_index.xml') {
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end(`<?xml version="1.0" encoding="UTF-8"?>
                <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                    <sitemap><loc>${baseUrl}/sitemap-pages.xml</loc></sitemap>
                </sitemapindex>`);
            return;
        }
        if (pathname === '/sitemap-pages.xml') {
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end(`<?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                    <url><loc>${baseUrl}/page-a</loc></url>
                    <url><loc>${baseUrl}/page-b</loc></url>
                </urlset>`);
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>ok</body></html>');
    });
    const crawler = new SitemapCrawler();
    const urls = await crawler.fetchSitemapUrls([`${baseUrl}/sitemap_index.xml`], baseUrl);
    server.close();

    assert.deepEqual(urls.sort(), [`${baseUrl}/page-a`, `${baseUrl}/page-b`]);
});
