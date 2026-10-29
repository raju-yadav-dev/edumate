const startTime = Date.now();
global.startupTimer = {
    start: startTime,
    log: function(stage, duration) {
        if (process.env.DISABLE_STARTUP_PROFILER === "true") return;
        const elapsed = duration !== undefined ? duration : (Date.now() - this.start);
        console.log(`[STARTUP] ${stage}: ${elapsed}ms`);
    }
};

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

global.startupTimer.log("Environment loaded");

// Global Exception and Rejection Handlers (Requirement 4)
process.on("uncaughtException", (error) => {
    console.error(`[UNCAUGHT EXCEPTION] [CRITICAL] ${error.stack || error}`);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error(`[UNHANDLED REJECTION] Reason: ${reason?.stack || reason}`);
});

// Memory Protection Monitor (Requirement 8 / 5)
let hasWarnedMemory = false;
setInterval(() => {
    const v8 = require("v8");
    const memory = process.memoryUsage();
    const heapLimit = v8.getHeapStatistics().heap_size_limit;
    const formatMB = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;
    
    let cacheSize = 0;
    try {
        const cacheService = require("./services/cacheService");
        cacheSize = cacheService.getCacheSize ? cacheService.getCacheSize() : 0;
    } catch (err) {}
    
    const heapPercentage = Number(((memory.heapUsed / heapLimit) * 100).toFixed(2));
    
    console.log(`[MEMORY MONITOR]
RSS: ${formatMB(memory.rss)}
Heap Used: ${formatMB(memory.heapUsed)}
Heap Limit: ${formatMB(heapLimit)}
External: ${formatMB(memory.external)}
Cache Size: ${cacheSize}
Heap Percentage: ${heapPercentage}%`);
    
    if (heapPercentage >= 80) {
        if (!hasWarnedMemory) {
            console.warn(`[MEMORY WARNING] Heap usage exceeds 80%! Current: ${heapPercentage}%`);
            hasWarnedMemory = true;
        }
    } else {
        hasWarnedMemory = false;
    }
}, 60000);

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {

    try {

        // console.clear();

        console.log(`
============================================================
 _____    _       __  __       _
| ____|__| |_   _|  \/  | __ _| |_ ___
|  _| / _\` | | | | |\/| |/ _\` | __/ _ \\
| |__| (_| | |_| | |  | | (_| | ||  __/
|_____\\__,_|\\__,_|_|  |_|\\__,_|\\__\\___|

============================================================

              AI Powered Campus Assistant
`);

        if (global.startupTimer) {
            global.startupTimer.log("MongoDB connection started");
        }

        // Start listening immediately
        app.listen(PORT, () => {
            if (global.startupTimer) {
                global.startupTimer.log("Server listening");
                const total = Date.now() - global.startupTimer.start;
                console.log(`[STARTUP] Total startup time: ${total}ms`);
            }
        });

        // Connect to MongoDB asynchronously in the background
        connectDB()
            .then(async () => {
                let campusLocationsReady = false;
                let crawlerSchedulerRunning = false;
                let qdrantConnected = false;
                let qdrantCollectionVerified = false;
                let campusNavigationReady = false;
                let ragIndexingReady = false;

                // Auto-seed campus locations if none exist
                try {
                    const Location = require("./models/Location");
                    const count = await Location.countDocuments();
                    if (count === 0) {
                        console.log("Seeding campus locations...");
                        const campusLocations = [
                            { name: "Main Gate", latitude: 22.7203, longitude: 88.4851, type: "campus", description: "Primary entrance for students, staff, and visitors." },
                            { name: "Admission Office", latitude: 22.7208, longitude: 88.4853, type: "campus", description: "Enquiries regarding admissions, registration, and forms." },
                            { name: "Library", latitude: 22.7211, longitude: 88.4855, type: "campus", description: "Central university library with extensive reference and books collection." },
                            { name: "Hostel", latitude: 22.7215, longitude: 88.4858, type: "campus", description: "Boys & Girls residential blocks inside campus." },
                            { name: "Auditorium", latitude: 22.7213, longitude: 88.4850, type: "campus", description: "Main hall for cultural events, fests, and guest lectures." },
                            { name: "Parking", latitude: 22.7201, longitude: 88.4849, type: "campus", description: "Two-wheeler and four-wheeler designated parking zone." },
                            { name: "Accounts Office", latitude: 22.7209, longitude: 88.4854, type: "campus", description: "Tuition fee payment clearance counters." },
                            { name: "Departments Block", latitude: 22.7210, longitude: 88.4852, type: "campus", description: "Engineering, Allied Sciences, and Humanities department HOD offices." },
                            { name: "Canteen", latitude: 22.7214, longitude: 88.4856, type: "campus", description: "Main cafeteria offering hot meals and snacks." },
                            { name: "Computer Lab", latitude: 22.7212, longitude: 88.4853, type: "campus", description: "Central computing center equipped with high-speed internet." },
                            { name: "Medical Room", latitude: 22.7207, longitude: 88.4854, type: "campus", description: "First-aid medical room with nursing assistant." },
                            { name: "Examination Cell", latitude: 22.7208, longitude: 88.4851, type: "campus", description: "Semester results, admit card distributions, and grade records." }
                        ];
                        await Location.insertMany(campusLocations);
                        console.log("✓ Campus locations successfully seeded.");
                    }
                    campusLocationsReady = true;
                } catch (e) {
                    console.error("⚠️ Failed to auto-seed campus locations:", e.message);
                }

                // Start background crawler sync scheduler
                try {
                    const syncScheduler = require("./crawler/SyncScheduler");
                    syncScheduler.start();
                    crawlerSchedulerRunning = true;
                } catch (e) {
                    console.error("⚠️ Failed to initialize background scheduler:", e.message);
                }

                // Verify Qdrant connection during startup
                try {
                    const { ensureCollection } = require("./ai/config/qdrant");
                    await ensureCollection();
                    qdrantConnected = true;
                    qdrantCollectionVerified = true;
                    console.log("✓ Qdrant collection verified successfully on startup.");
                } catch (e) {
                    console.error("⚠️ WARNING: Qdrant connection failed during startup:", e.message);
                }

                // Campus Navigation startup migration and reindexing
                const Document = require("./models/Document");
                const indexingService = require("./ai/services/indexingService");

                try {
                    const ROMAN_MAP = {
                        "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8", "ix": "9",
                        "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9"
                    };

                    const docsToMigrate = await Document.find({ status: "active", category: "campus_navigation_campus" });
                    if (docsToMigrate.length > 0) {
                        console.log(`[Startup Migration] Found ${docsToMigrate.length} building documents in old category.`);
                        for (const doc of docsToMigrate) {
                            const fileNumMatch = doc.originalName.match(/(?:Building|Buliding)\s+([IVX0-9]+)/i);
                            if (fileNumMatch) {
                                const rawNum = fileNumMatch[1].toLowerCase();
                                const num = ROMAN_MAP[rawNum] || fileNumMatch[1];
                                doc.category = `campus_navigation_building_${num}`;
                                await doc.save();
                                console.log(`[Startup Migration] Migrated category of ${doc.originalName} to "${doc.category}"`);
                            }
                        }
                    }
                    campusNavigationReady = true;
                } catch (migErr) {
                    console.error("⚠️ Failed running Campus Navigation startup migration:", migErr.message);
                }

                // RAG Indexing startup check
                try {
                    const Chunk = require("./models/Chunk");
                    const count = await Chunk.countDocuments({ "metadata.sourceType": "campus_navigation" });
                    const campusDocs = await Document.find({ status: "active", category: /^campus_navigation/ });
                    
                    if (count === 0 && campusDocs.length > 0) {
                        console.log(`[Startup] Migration required for ${campusDocs.length} documents.`);
                        console.log("[Startup] Automatic migration skipped.");
                        console.log("[Startup] Use the manual reindex operation when required.");
                    } else if (campusDocs.length > 0) {
                        console.log("[Startup] Existing knowledge base detected.");
                        console.log("[Startup] Automatic reindexing skipped.");
                        console.log("[Startup] Use the manual reindex operation when required.");
                    }
                    ragIndexingReady = true;
                } catch (ragErr) {
                    console.error("⚠️ Failed running RAG Indexing startup check:", ragErr.message);
                }

                // Local Storage & file_explorer initialization for RAG
                try {
                    const localStorageManager = require("./storage/localStorageManager");
                    const storageRoot = localStorageManager.ensureStorageRoot();
                    console.log(`✓ Local Storage initialized (Root: ${storageRoot}, file_explorer ready).`);
                } catch (storageErr) {
                    console.error("⚠️ Failed to initialize local storage root:", storageErr.message);
                }

                // Parallel checks for other services
                const [aiCheck, mapCheck] = await Promise.all([
                    // AI services check (llama.cpp probe)
                    (async () => {
                        try {
                            const { checkLlmHealth } = require("./config/llm");
                            const isHealthy = await checkLlmHealth(3000);
                            return { llmAvailable: isHealthy };
                        } catch (e) {
                            return { llmAvailable: false };
                        }
                    })(),
                    // Map services check
                    (async () => {
                        try {
                            const keysSetting = await require("./services/settingsService").getApiKeys().catch(() => ({}));
                            const rawApiKey = keysSetting.openRouteServiceApiKey || process.env.OPENROUTE_SERVICE_API_KEY;
                            const openRouteServiceConfigured = !!(rawApiKey && rawApiKey !== "YOUR_KEY_HERE" && rawApiKey.trim() !== "");
                            return { openRouteServiceConfigured, routingAvailable: openRouteServiceConfigured };
                        } catch (e) {
                            return { openRouteServiceConfigured: false, routingAvailable: false };
                        }
                    })()
                ]);

                // MongoDB dynamic status info
                const mongoose = require("mongoose");
                const mongoConnected = mongoose.connection && mongoose.connection.readyState === 1;
                const mongoDbName = mongoConnected ? mongoose.connection.name : "EduMate";
                const uri = process.env.MONGODB_URI || "";
                const isAtlas = uri.includes(".mongodb.net") || uri.includes("mongodb+srv");
                const mongoProvider = isAtlas ? "MongoDB Atlas" : "Local MongoDB";

                // Format elements for terminal dashboard
                const colors = require("./scripts/colors");
                const borderDouble = colors.cyan(`+${"=".repeat(58)}+`);
                const borderSingle = colors.cyan(`+${"-".repeat(58)}+`);

                const padLine = (label, value, labelWidth = 12, totalWidth = 60, valueColorFn = null) => {
                    const paddedLabel = label.padEnd(labelWidth, " ");
                    const prefixUnstyled = `| ${paddedLabel}: ${value}`;
                    const paddingLength = totalWidth - prefixUnstyled.length - 2;
                    const padding = paddingLength > 0 ? " ".repeat(paddingLength) : "";
                    
                    const styledValue = valueColorFn ? valueColorFn(value) : value;
                    return `${colors.cyan("|")} ${paddedLabel}: ${styledValue}${padding} ${colors.cyan("|")}`;
                };

                const padSimpleLine = (content, totalWidth = 60) => {
                    const prefixUnstyled = `| ${content}`;
                    const paddingLength = totalWidth - prefixUnstyled.length - 2;
                    const padding = paddingLength > 0 ? " ".repeat(paddingLength) : "";
                    return `${colors.cyan("|")} ${content}${padding} ${colors.cyan("|")}`;
                };

                const padCenteredLine = (content, totalWidth = 60, colorFn = null) => {
                    const innerWidth = totalWidth - 2;
                    const contentLen = content.length;
                    const totalSpaces = innerWidth - contentLen;
                    const leftSpaces = Math.floor(totalSpaces / 2);
                    const rightSpaces = totalSpaces - leftSpaces;
                    const styledContent = colorFn ? colorFn(content) : content;
                    return `${colors.cyan("|")}${" ".repeat(leftSpaces)}${styledContent}${" ".repeat(rightSpaces)}${colors.cyan("|")}`;
                };

                const makeSectionHeader = (title, totalWidth = 60) => {
                    const prefix = "+------------------- ";
                    const label = `${title} `;
                    const remaining = totalWidth - prefix.length - label.length - 1;
                    const dashes = remaining > 0 ? "-".repeat(remaining) : "";
                    return colors.cyan(`${prefix}${label}${dashes}+`);
                };

                const getFormattedStartedDate = () => {
                    const d = new Date();
                    const day = String(d.getDate()).padStart(2, "0");
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const year = d.getFullYear();
                    
                    let hours = d.getHours();
                    const minutes = String(d.getMinutes()).padStart(2, "0");
                    const seconds = String(d.getSeconds()).padStart(2, "0");
                    const ampm = hours >= 12 ? "PM" : "AM";
                    hours = hours % 12;
                    hours = hours ? hours : 12;
                    const formattedHours = String(hours);
                    
                    return `${day}/${month}/${year}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
                };

                // Build full dashboard
                const dashboard = [];
                
                dashboard.push(borderDouble);
                dashboard.push(padCenteredLine("✓ EDUMATE SERVER STARTED", 60, (t) => colors.bold(colors.green(t))));
                dashboard.push(borderDouble);
                dashboard.push(padSimpleLine(""));
                dashboard.push(padLine("Environment", process.env.NODE_ENV || "development", 12));
                dashboard.push(padLine("Port", String(PORT), 12));
                dashboard.push(padLine("API", `http://localhost:${PORT}`, 12));
                dashboard.push(padLine("Started", getFormattedStartedDate(), 12));
                dashboard.push(padSimpleLine(""));
                dashboard.push(borderDouble);
                
                dashboard.push("");
                
                dashboard.push(borderDouble);
                dashboard.push(padCenteredLine("DATABASE CONNECTION STATUS", 60, (t) => colors.bold(colors.cyan(t))));
                dashboard.push(borderDouble);
                
                dashboard.push("");
                
                dashboard.push(makeSectionHeader("MONGODB"));
                dashboard.push(padLine("Status", mongoConnected ? "✓ Connected" : "❌ Disconnected", 12, 60, mongoConnected ? colors.green : colors.red));
                dashboard.push(padLine("Database", mongoDbName, 12));
                dashboard.push(padLine("Provider", mongoProvider, 12));
                dashboard.push(borderSingle);
                
                dashboard.push("");
                
                const qdrantStatusText = qdrantConnected ? "✓ Connected" : "❌ Disconnected";
                const qdrantCollText = qdrantCollectionVerified ? "✓ Verified" : "⚠️ Unverified";
                dashboard.push(makeSectionHeader("QDRANT"));
                dashboard.push(padLine("Status", qdrantStatusText, 12, 60, qdrantConnected ? colors.green : colors.red));
                dashboard.push(padLine("Service", "Qdrant Vector Database", 12));
                dashboard.push(padLine("Collection", qdrantCollText, 12, 60, qdrantCollectionVerified ? colors.green : colors.yellow));
                dashboard.push(borderSingle);
                
                dashboard.push("");
                
                // Storage section
                const localPath = process.env.LOCAL_STORAGE_PATH || "./storage";
                dashboard.push(makeSectionHeader("LOCAL STORAGE"));
                dashboard.push(padLine("Status", "✓ Ready", 12, 60, colors.green));
                dashboard.push(padLine("Provider", "Local Filesystem", 12));
                dashboard.push(padLine("Path", localPath, 12));
                dashboard.push(borderSingle);
                
                dashboard.push("");
                
                const { getLlmConfig } = require("./config/llm");
                const llmConfig = getLlmConfig();

                const llamaStatusText = aiCheck.llmAvailable ? "✓ Connected" : "❌ Disconnected";
                dashboard.push(makeSectionHeader("AI SERVICES"));
                dashboard.push(padLine("Provider", llmConfig.provider, 12));
                dashboard.push(padLine("Model", llmConfig.model, 12));
                dashboard.push(padLine("Endpoint", llmConfig.baseUrl, 12));
                dashboard.push(padLine("Status", llamaStatusText, 12, 60, aiCheck.llmAvailable ? colors.green : colors.red));
                dashboard.push(borderSingle);
                
                dashboard.push("");
                
                const mapApiText = mapCheck.openRouteServiceConfigured ? "✓ Configured" : "⚠️ Not Configured";
                const routingText = mapCheck.routingAvailable ? "✓ Available" : "⚠️ Unavailable";
                dashboard.push(makeSectionHeader("MAP SERVICES"));
                dashboard.push(padLine("OpenRouteService", mapApiText, 17, 60, mapCheck.openRouteServiceConfigured ? colors.green : colors.yellow));
                dashboard.push(padLine("Routing", routingText, 17, 60, mapCheck.routingAvailable ? colors.green : colors.red));
                dashboard.push(borderSingle);
                
                dashboard.push("");
                
                dashboard.push(borderDouble);
                dashboard.push(padCenteredLine("BACKGROUND SERVICES", 60, (t) => colors.bold(colors.cyan(t))));
                dashboard.push(borderDouble);
                dashboard.push(padSimpleLine(""));
                dashboard.push(padLine("Campus Locations", campusLocationsReady ? "✓ Ready" : "⚠️ Error", 18, 60, campusLocationsReady ? colors.green : colors.red));
                dashboard.push(padLine("Crawler Scheduler", crawlerSchedulerRunning ? "✓ Running" : "⚠️ Error", 18, 60, crawlerSchedulerRunning ? colors.green : colors.red));
                dashboard.push(padLine("Campus Navigation", campusNavigationReady ? "✓ Ready" : "⚠️ Error", 18, 60, campusNavigationReady ? colors.green : colors.red));
                dashboard.push(padLine("RAG Indexing", ragIndexingReady ? "✓ Ready" : "⚠️ Error", 18, 60, ragIndexingReady ? colors.green : colors.red));
                dashboard.push(padSimpleLine(""));
                dashboard.push(borderDouble);
                
                dashboard.push("");
                
                dashboard.push(borderDouble);
                dashboard.push(
                    padCenteredLine(
                        "✓ EDUMATE READY",
                        60,
                        (t) => colors.bold(colors.green(t))
                    )
                );
                dashboard.push(borderDouble);
                dashboard.push(
                    padLine(
                        "Backend",
                        `http://localhost:${PORT}`,
                        8
                    )
                );
                dashboard.push(
                    padLine(
                        "Qdrant",
                        "http://localhost:6333",
                        8
                    )
                );
                dashboard.push(
                    padLine(
                        "Frontend",
                        "http://localhost:5173",
                        8
                    )
                );
                dashboard.push(borderDouble);
                
                console.log("\n" + dashboard.join("\n") + "\n");

                console.log(`AI Provider : ${llmConfig.provider}`);
                console.log(`Model       : ${llmConfig.model}`);
                console.log(`Endpoint    : ${llmConfig.baseUrl}`);
                console.log(`Status      : ${aiCheck.llmAvailable ? "Connected" : "Disconnected"}`);
                console.log();

                // Mission 14.1 — 10-Layer Smart Cache Architecture Report
                try {
                    const cacheService = require("./services/cacheService");
                    console.log(cacheService.generateCacheReport());
                    console.log();
                } catch (_) {}
            });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

startServer();