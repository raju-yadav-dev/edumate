const crypto = require("crypto");

class TaskRegistry {
    constructor() {
        this.tasks = new Map();
        this.queue = [];
        this.isProcessing = false;
    }

    createTask(name, type) {
        const id = crypto.randomUUID();
        const task = {
            id,
            name,
            type,
            status: "pending", // pending | processing | completed | failed
            progress: 0,
            error: null,
            result: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.tasks.set(id, task);
        return task;
    }

    updateTask(id, updates) {
        const task = this.tasks.get(id);
        if (task) {
            Object.assign(task, updates, { updatedAt: new Date().toISOString() });
            this.tasks.set(id, task);
        }
    }

    getTask(id) {
        return this.tasks.get(id);
    }

    getAllTasks() {
        return Array.from(this.tasks.values());
    }

    /**
     * Add a function to execution queue.
     */
    addTask(taskId, fn) {
        this.queue.push({ taskId, fn });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const { taskId, fn } = this.queue.shift();
            this.updateTask(taskId, { status: "processing", progress: 10 });
            try {
                const result = await fn((progressValue) => {
                    this.updateTask(taskId, { progress: progressValue });
                });
                this.updateTask(taskId, { status: "completed", progress: 100, result });
            } catch (err) {
                console.error(`[TaskRegistry] Task ${taskId} failed:`, err);
                this.updateTask(taskId, { status: "failed", progress: 100, error: err.message });
            }
        }

        this.isProcessing = false;
    }
}

const taskRegistry = new TaskRegistry();
module.exports = taskRegistry;
