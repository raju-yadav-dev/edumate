const AI_CONSTANTS = require("../constants/aiConstants");

class RecursiveCharacterTextSplitter {
    constructor({
        chunkSize = AI_CONSTANTS.CHUNK_SIZE,
        chunkOverlap = AI_CONSTANTS.CHUNK_OVERLAP,
        separators = AI_CONSTANTS.CHUNK_SEPARATORS
    } = {}) {
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
        if (!text || typeof text !== "string") {
            return [];
        }
        return this._splitText(text, this.separators);
    }

    _splitText(text, separators) {
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

        const splits = text.split(separator);
        const goodSplits = [];

        for (const split of splits) {
            if (split.length > this.chunkSize) {
                if (nextSeparators.length > 0) {
                    const subSplits = this._splitText(split, nextSeparators);
                    goodSplits.push(...subSplits);
                } else {
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

/**
 * Standard utility function to split a document's text into chunks
 * @param {string} text
 * @returns {Array<string>}
 */
const chunkDocument = (text) => {
    const splitter = new RecursiveCharacterTextSplitter();
    return splitter.splitText(text);
};

module.exports = {
    RecursiveCharacterTextSplitter,
    chunkDocument
};
