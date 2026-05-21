const { app } = require('@azure/functions');
const { JSDOM } = require('jsdom');

// Looks up the top Wikipedia article for a query using the OpenSearch API.
// Returns { title, url } or null if nothing is found.
async function findWikipediaArticle(query, language) {
    const lang = language === 'da' ? 'da' : 'en';
    const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;

    const response = await fetch(apiUrl);
    if (!response.ok) return null;

    const [, titles, , urls] = await response.json();
    if (!urls || urls.length === 0) return null;

    return { title: titles[0], url: urls[0] };
}

// Fetches a Wikipedia page and extracts readable text content using JSDOM.
async function scrapeWikipediaPage(pageUrl) {
    const response = await fetch(pageUrl);
    if (!response.ok) return null;

    const html = await response.text();
    const { window } = new JSDOM(html);
    const document = window.document;

    const content = Array.from(
        document.querySelectorAll('.mw-parser-output p, .mw-parser-output h1, .mw-parser-output h2, .mw-parser-output h3')
    )
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0)
        .join(' ')
        .replace(/[\t\n\r]+/g, ' ')
        .trim();

    return content || null;
}

// Azure Storage Queue trigger — fires for every missed search enqueued by the Go server.
// The Go server base64-encodes a JSON message: { "query": "...", "language": "en" }
// The Azure Functions runtime automatically base64-decodes it and parses JSON.
app.storageQueue('web-crawler-queue-trigger', {
    queueName: process.env.QUEUE_NAME || 'missed-searches',
    connection: 'AzureWebJobsStorage',
    handler: async (queueItem, context) => {
        // The runtime delivers the decoded message; handle both object and string forms.
        const message = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
        const { query, language } = message;

        context.log(`Processing missed search: "${query}" (language: ${language})`);

        const article = await findWikipediaArticle(query, language);
        if (!article) {
            context.log(`No Wikipedia article found for: "${query}"`);
            return;
        }

        const content = await scrapeWikipediaPage(article.url);
        if (!content) {
            context.log(`Could not extract content from: ${article.url}`);
            return;
        }

        const serverUrl = process.env.WHOKNOWS_SERVER_URL;
        const apiKey = process.env.WHOKNOWS_SCRAPER_API_KEY;

        if (!serverUrl || !apiKey) {
            context.log.error('WHOKNOWS_SERVER_URL or WHOKNOWS_SCRAPER_API_KEY is not set');
            return;
        }

        const response = await fetch(`${serverUrl}/api/pages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Scraper-Key': apiKey,
            },
            body: JSON.stringify({
                title: article.title,
                url: article.url,
                language: language || 'en',
                content,
            }),
        });

        if (response.ok) {
            context.log(`Indexed: "${article.title}" (${article.url})`);
        } else {
            context.log.error(`Failed to index "${article.title}": HTTP ${response.status}`);
        }
    },
});
