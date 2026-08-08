const test = require('node:test');
const assert = require('node:assert/strict');
const QueueManager = require('../QueueManager');

test('QueueManager exposes queued, processing, indexed and failed counts', () => {
    const queueManager = new QueueManager(10, 3);

    queueManager.enqueue('https://example.edu/page-a', 0, 'https://example.edu');
    queueManager.enqueue('https://example.edu/page-b', 0, 'https://example.edu');

    const first = queueManager.dequeue();
    assert.equal(first.url, 'https://example.edu/page-a');

    queueManager.setUrlStatus('https://example.edu/page-a', 'processing');
    queueManager.markCrawled('https://example.edu/page-a');
    queueManager.markFailed('https://example.edu/page-b', 'boom');

    const stats = queueManager.getStats();

    assert.equal(stats.discovered, 2);
    assert.equal(stats.queued, 1);
    assert.equal(stats.processing, 0);
    assert.equal(stats.indexed, 1);
    assert.equal(stats.failed, 1);
});
