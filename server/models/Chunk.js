/**
 * Legacy MongoDB Chunk Model Migration Stub (Mission 13.3)
 * 
 * MongoDB no longer stores chunk text or chunk collections.
 * All chunk data is managed locally via `server/storage/localChunkManager.js`.
 * 
 * This module ensures the MongoDB `chunks` collection is dropped and provides
 * safe compatibility bridges.
 */

const mongoose = require("mongoose");
const localChunkManager = require("../storage/localChunkManager");

// Drop legacy MongoDB chunks collection on connection ready
if (mongoose.connection) {
    const dropMongoChunksCollection = async () => {
        try {
            if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
                const collections = await mongoose.connection.db.listCollections({ name: "chunks" }).toArray();
                if (collections.length > 0) {
                    await mongoose.connection.db.collection("chunks").drop();
                    console.log("[Migration] Successfully dropped legacy MongoDB 'chunks' collection.");
                }
            }
        } catch (err) {
            // Ignore if collection doesn't exist
        }
    };

    if (mongoose.connection.readyState === 1) {
        dropMongoChunksCollection();
    } else {
        mongoose.connection.once("connected", dropMongoChunksCollection);
    }
}

// Compatibility layer forwarding to localChunkManager
const ChunkCompat = {
    find: (query = {}) => {
        const docId = query.document || query["metadata.documentId"] || query._id;
        if (docId) {
            const chunks = localChunkManager.getDocumentChunks(docId);
            return {
                lean: () => Promise.resolve(chunks),
                sort: () => ({
                    lean: () => Promise.resolve(chunks),
                    exec: () => Promise.resolve(chunks)
                }),
                limit: () => ({
                    lean: () => Promise.resolve(chunks),
                    exec: () => Promise.resolve(chunks)
                }),
                exec: () => Promise.resolve(chunks),
                then: (resolve) => resolve(chunks)
            };
        }
        return {
            lean: () => Promise.resolve([]),
            sort: () => ({ lean: () => Promise.resolve([]) }),
            limit: () => ({ lean: () => Promise.resolve([]) }),
            exec: () => Promise.resolve([]),
            then: (resolve) => resolve([])
        };
    },
    findOne: (query = {}) => {
        return {
            lean: () => Promise.resolve(null),
            exec: () => Promise.resolve(null),
            then: (resolve) => resolve(null)
        };
    },
    countDocuments: async (query = {}) => {
        if (query.document) {
            return localChunkManager.getChunkCount(query.document);
        }
        const stats = localChunkManager.getAllChunkStats();
        return stats.totalChunks;
    },
    deleteMany: async (query = {}) => {
        if (query.document) {
            await localChunkManager.deleteDocumentChunks(query.document);
        }
        return { deletedCount: 0 };
    },
    insertMany: async (chunkDocs = []) => {
        if (!Array.isArray(chunkDocs) || chunkDocs.length === 0) return [];
        const docId = chunkDocs[0].document || chunkDocs[0].metadata?.documentId;
        if (docId) {
            await localChunkManager.saveDocumentChunks(docId, chunkDocs);
        }
        return chunkDocs;
    }
};

module.exports = ChunkCompat;
