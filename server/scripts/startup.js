const colors = require("./colors");
const { verifyNodeVersion, verifyDependencies } = require("./dependencyInstaller");
const { verifyEnvironment } = require("./verifyEnvironment");
const { startQdrantContainer } = require("./dockerManager");
const { verifyMongo } = require("./verifyMongo");
const { verifySupabase } = require("./verifySupabase");
const { verifyGemini } = require("./verifyGemini");
const { verifyQdrant } = require("./verifyQdrant");
const { printBanner, printDashboard } = require("./banner");
const { spawn } = require("child_process");

/**
 * Main startup sequence that checks services and launches server
 */
const startApp = async () => {
    printBanner();
    console.log(colors.cyan("🚀 Initializing EduMate automated startup sequence...\n"));

    // 1. Verify Node version & npm packages
    verifyNodeVersion();
    verifyDependencies();

    console.log();

    // 2. Verify .env configurations
    const envOk = verifyEnvironment();
    if (!envOk) {
        console.error(colors.red("❌ Startup blocked: Environment variables are not configured correctly."));
        process.exit(1);
    }

    console.log();

    // 3. Boot and verify local Qdrant container
    const qdrantTriggered = await startQdrantContainer();
    console.log();

    // Poll Qdrant (retrying up to 10 attempts while Docker initializes in the background)
    const qdrantOk = await verifyQdrant(15);
    if (!qdrantOk) {
        console.error(colors.red("❌ Startup blocked: Unable to verify Qdrant database state."));
        process.exit(1);
    }

    console.log();

    // 4. Verify MongoDB
    const mongoOk = await verifyMongo();
    if (!mongoOk) {
        console.error(colors.red("❌ Startup blocked: MongoDB connection check failed."));
        process.exit(1);
    }

    console.log();

    // 5. Verify Supabase
    const supabaseOk = await verifySupabase();
    if (!supabaseOk) {
        console.error(colors.red("❌ Startup blocked: Supabase connection check failed."));
        process.exit(1);
    }

    console.log();

    // 6. Verify Gemini API Key
    const geminiOk = await verifyGemini();
    if (!geminiOk) {
        console.error(colors.red("❌ Startup blocked: Google Gemini API connection check failed."));
        process.exit(1);
    }

    console.log();

    // 7. Success: Print Dashboard and spawn application process
    printDashboard({
        env: process.env.NODE_ENV || "development",
        port: process.env.PORT || "5000"
    });

    // Check if nodemon is available for hot reloading
    let runner = "node";
    let args = ["server.js"];

    try {
        require.resolve("nodemon");
        runner = "npx";
        args = ["nodemon", "server.js"];
    } catch (e) {
        // Fall back to standard node execution
    }

    console.log(colors.cyan(`Starting server with command: ${runner} ${args.join(" ")}\n`));
    
    const serverProcess = spawn(runner, args, {
        stdio: "inherit",
        shell: true,
        cwd: process.cwd()
    });

    serverProcess.on("close", (code) => {
        process.exit(code);
    });
};

startApp().catch((err) => {
    console.error(colors.red(`❌ Server startup failed critically: ${err.message}`));
    process.exit(1);
});
