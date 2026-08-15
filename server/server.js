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
                } catch (e) {
                    console.error("⚠️ Failed to auto-seed campus locations:", e.message);
                }

                // Start background crawler sync scheduler
                try {
                    const syncScheduler = require("./crawler/SyncScheduler");
                    syncScheduler.start();
                } catch (e) {
                    console.error("⚠️ Failed to initialize background scheduler:", e.message);
                }
            })
            .catch((err) => {
                console.warn("[STARTUP WARNING] MongoDB unavailable.");
            });

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

startServer();