/**
 * VadService.js
 * Lightweight Voice Activity Detection service.
 * Browser Web Speech API and AudioAnalyserService handle voice activity and silence
 * detection natively without external neural-network WASM dependencies.
 */

class VadService {
    constructor() {
        this.isActive = false;
        this.onSpeechStartCallback = null;
        this.onSpeechEndCallback = null;
    }

    async init(onSpeechStart, onSpeechEnd) {
        this.onSpeechStartCallback = onSpeechStart;
        this.onSpeechEndCallback = onSpeechEnd;
        return true;
    }

    start() {
        this.isActive = true;
    }

    stop() {
        this.isActive = false;
    }
}

export default new VadService();
