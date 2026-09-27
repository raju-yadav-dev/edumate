/**
 * Circuit Breaker for External AI and Service Dependencies
 * 
 * States:
 * - CLOSED: Normal operation. Requests flow through.
 * - OPEN: Tripped due to consecutive failures. Fast-fails immediately.
 * - HALF_OPEN: Testing if service has recovered with a trial request.
 */

class CircuitBreaker {
    constructor({
        name = "llm-circuit-breaker",
        failureThreshold = 3,
        resetTimeoutMs = 30000
    } = {}) {
        this.name = name;
        this.failureThreshold = failureThreshold;
        this.resetTimeoutMs = resetTimeoutMs;
        
        this.state = "CLOSED";
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = Date.now();
    }

    /**
     * Checks whether a request is allowed to proceed.
     * @returns {boolean}
     */
    canExecute() {
        if (this.state === "CLOSED") {
            return true;
        }

        const now = Date.now();
        if (this.state === "OPEN") {
            if (this.lastFailureTime && (now - this.lastFailureTime > this.resetTimeoutMs)) {
                console.log(`[Circuit Breaker] ${this.name} transitioning from OPEN to HALF_OPEN (probe request allowed).`);
                this.state = "HALF_OPEN";
                return true;
            }
            return false;
        }

        // HALF_OPEN allows single test probe
        return true;
    }

    /**
     * Records a successful execution and resets the breaker.
     */
    recordSuccess() {
        if (this.state !== "CLOSED") {
            console.log(`[Circuit Breaker] ${this.name} recovered. Transitioning to CLOSED.`);
        }
        this.failureCount = 0;
        this.state = "CLOSED";
        this.lastSuccessTime = Date.now();
    }

    /**
     * Records a failed execution and trips if threshold reached.
     * @param {Error} [error]
     */
    recordFailure(error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === "HALF_OPEN" || this.failureCount >= this.failureThreshold) {
            if (this.state !== "OPEN") {
                console.warn(`[Circuit Breaker] ${this.name} TRIPPED to OPEN after ${this.failureCount} failure(s). Error: ${error?.message || "Unknown"}`);
            }
            this.state = "OPEN";
        }
    }

    /**
     * Force resets the breaker to CLOSED (e.g. after successful health check probe).
     */
    reset() {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.lastSuccessTime = Date.now();
    }

    /**
     * Force trips the breaker to OPEN.
     */
    trip() {
        this.state = "OPEN";
        this.lastFailureTime = Date.now();
    }

    /**
     * Returns current status snapshot.
     */
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            failureThreshold: this.failureThreshold,
            lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
            lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : null
        };
    }
}

// Singleton LLM Circuit Breaker instance
const llmCircuitBreaker = new CircuitBreaker({
    name: "llama.cpp",
    failureThreshold: 3,
    resetTimeoutMs: 30000
});

module.exports = {
    CircuitBreaker,
    llmCircuitBreaker
};
