const test = require("node:test");
const assert = require("node:assert/strict");
const QueueManager = require("../crawler/QueueManager");

test("queue manager tracks pending and completed URL statuses", () => {
    const manager = new QueueManager(10, 2);

    manager.enqueue("https://example.com/page-1", 0, "https://example.com");
    manager.setUrlStatus("https://example.com/page-1", "processing");
    manager.setUrlStatus("https://example.com/page-2", "completed");

    const stats = manager.getStats();

    assert.equal(stats.pending, 1);
    assert.equal(stats.completed, 1);
    assert.equal(stats.failed, 0);
});
