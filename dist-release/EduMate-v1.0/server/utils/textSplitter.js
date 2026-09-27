class RecursiveCharacterTextSplitter {
    constructor({ chunkSize = 800, chunkOverlap = 150, separators = ["\n\n", "\n", " ", ""] } = {}) {
        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;
        this.separators = separators;
    }

    /**
     * Splits text recursively based on the configured separators
     * @param {string} text
     * @returns {Array<string>}
     */
    splitText(text) {
        return this._splitText(text, this.separators);
    }

    _splitText(text, separators) {
        // Find the first separator that exists in the text
        let separator = separators[separators.length - 1];
        let nextSeparators = [];

        for (let i = 0; i < separators.length; i++) {
            const sep = separators[i];
            if (sep === "") {
                separator = sep;
                nextSeparators = [];
                break;
            }
            if (text.includes(sep)) {
                separator = sep;
                nextSeparators = separators.slice(i + 1);
                break;
            }
        }

        // Split text by the separator
        const splits = text.split(separator);
        const goodSplits = [];

        for (const split of splits) {
            if (split.length > this.chunkSize) {
                // Split recursively if it's too large
                if (nextSeparators.length > 0) {
                    const subSplits = this._splitText(split, nextSeparators);
                    goodSplits.push(...subSplits);
                } else {
                    // Fallback to hard slicing if no separators left
                    let start = 0;
                    while (start < split.length) {
                        goodSplits.push(split.substring(start, start + this.chunkSize));
                        start += this.chunkSize - this.chunkOverlap;
                    }
                }
            } else {
                goodSplits.push(split);
            }
        }

        // Merge splits respecting chunkSize and chunkOverlap
        return this.mergeSplits(goodSplits, separator);
    }

    mergeSplits(splits, separator) {
        const chunks = [];
        let currentSplits = [];
        let currentLength = 0;

        for (const split of splits) {
            const splitLength = split.length;
            const separatorLength = currentSplits.length > 0 ? separator.length : 0;
            const totalPotentialLength = currentLength + splitLength + separatorLength;

            if (totalPotentialLength > this.chunkSize) {
                if (currentSplits.length > 0) {
                    chunks.push(currentSplits.join(separator));
                }

                // Keep removing splits from the front until we have room for the overlap
                while (currentSplits.length > 0) {
                    const removed = currentSplits.shift();
                    const nextSepLen = currentSplits.length > 0 ? separator.length : 0;
                    currentLength -= (removed.length + nextSepLen);
                    
                    const overlapLength = currentLength + splitLength + (currentSplits.length > 0 ? separator.length : 0);
                    if (overlapLength <= this.chunkOverlap) {
                        break;
                    }
                }
            }

            currentSplits.push(split);
            currentLength += splitLength + (currentSplits.length > 1 ? separator.length : 0);
        }

        if (currentSplits.length > 0) {
            chunks.push(currentSplits.join(separator));
        }

        return chunks;
    }
}

module.exports = RecursiveCharacterTextSplitter;
