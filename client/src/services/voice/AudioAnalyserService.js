/**
 * AudioAnalyserService.js
 * Service for capturing microphone input and analyzing real-time audio levels/waveforms.
 */

class AudioAnalyserService {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.stream = null;
        this.source = null;
        this.dataArray = null;
        this.isAnalysing = false;
    }

    /**
     * Start capturing and analysing microphone audio.
     * @returns {Promise<boolean>} Resolves to true if successful, false otherwise.
     */
    async start() {
        if (this.isAnalysing) return true;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            console.warn("Web Audio API not supported by this browser.");
            return false;
        }

        try {
            // 1. Request microphone stream access
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 2. Initialize AudioContext and Analyser
            this.audioContext = new AudioContextClass();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256; // 128 bins for fine frequency analysis

            // 3. Connect microphone to analyser
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);

            // 4. Prepare data buffer
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            // Resume context if suspended (browser security restriction)
            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume();
            }

            this.isAnalysing = true;
            console.log("[AudioAnalyserService] Microphone analysis active.");
            return true;
        } catch (err) {
            console.error("Failed to start AudioAnalyserService:", err);
            this.stop();
            return false;
        }
    }

    /**
     * Stop capturing and release microphone resources.
     */
    stop() {
        this.isAnalysing = false;

        // Stop all media tracks to turn off camera/microphone indicator lights
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        if (this.audioContext) {
            if (this.audioContext.state !== "closed") {
                this.audioContext.close().catch(err => {
                    console.warn("Error closing AudioContext:", err);
                });
            }
            this.audioContext = null;
        }

        this.analyser = null;
        this.dataArray = null;
        console.log("[AudioAnalyserService] Microphone analysis stopped.");
    }

    /**
     * Retrieves the raw frequency data.
     * @returns {Uint8Array|null}
     */
    getFrequencyData() {
        if (!this.analyser || !this.dataArray) return null;
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    /**
     * Retrieves the raw time-domain (waveform) data.
     * @returns {Uint8Array|null}
     */
    getWaveformData() {
        if (!this.analyser || !this.dataArray) return null;
        this.analyser.getByteTimeDomainData(this.dataArray);
        return this.dataArray;
    }

    /**
     * Computes the average volume amplitude.
     * @returns {number} Average amplitude (0.0 to 1.0)
     */
    getAverageVolume() {
        const waveform = this.getWaveformData();
        if (!waveform) return 0;

        let sumOfSquares = 0;
        for (let i = 0; i < waveform.length; i++) {
            // Normalize values from 0-255 range to -1.0 to 1.0 range
            const normalizedValue = (waveform[i] - 128) / 128;
            sumOfSquares += normalizedValue * normalizedValue;
        }

        const rms = Math.sqrt(sumOfSquares / waveform.length);
        
        // Scale and cap
        return Math.min(1.0, rms * 2.5);
    }
}

export default new AudioAnalyserService();
