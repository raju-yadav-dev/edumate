const colors = require("./colors");
const { verifyNodeVersion, verifyDependencies } = require("./dependencyInstaller");
const { verifyEnvironment } = require("./verifyEnvironment");
const { verifyMongo } = require("./verifyMongo");
const { verifyGroq } = require("./verifyGroq");
const { verifyQdrant } = require("./verifyQdrant");
const { checkInternet } = require("./healthCheck");
const { printBanner } = require("./banner");

/**
 * Executes a full diagnostic trace of the local server development environment
 */
const runDoctor = async () => {
    printBanner();
    console.log(colors.cyan("💉 Starting EduMate Doctor Diagnostics Checklist...\n"));
    
    let hasErrors = false;

    // 1. Verify Node version
    try {
        verifyNodeVersion();
    } catch (e) {
        hasErrors = true;
    }

    console.log();

    // 2. Verify Internet Connection
    await checkInternet();

    console.log();

    // 3. Verify node dependencies
    try {
        verifyDependencies();
    } catch (e) {
        hasErrors = true;
    }

    console.log();

    // 4. Verify environment configurations
    const envOk = verifyEnvironment();
    if (!envOk) {
        hasErrors = true;
    }

    console.log();

    if (envOk) {
        // 5. Verify MongoDB connectivity
        const mongoOk = await verifyMongo();
        if (!mongoOk) {
            hasErrors = true;
            console.log(colors.yellow("💡 Suggestion: Confirm MONGODB_URI is correct and your IP is whitelisted."));
        }
        
        console.log();

        // 7. Verify Groq API connectivity
        const groqOk = await verifyGroq();
        if (!groqOk) {
            hasErrors = true;
            console.log(colors.yellow("💡 Suggestion: Confirm GROQ_API_KEY is active and correct in settings or environment."));
        }

        console.log();

        // 8. Verify Qdrant connectivity
        const qdrantOk = await verifyQdrant(2); // check only twice for quick diagnostics
        if (!qdrantOk) {
            hasErrors = true;
            console.log(colors.yellow("\n💡 Suggestion: Ensure Qdrant is running. Try executing:"));
            console.log(colors.cyan("   docker compose up -d"));
        }
    }

    console.log("\n" + colors.cyan("============================================================"));
    if (hasErrors) {
        console.log(colors.red("❌ EduMate Doctor found issues with your development environment."));
        console.log(colors.yellow("Please resolve the warnings/errors above and rerun 'npm run doctor'."));
        process.exit(1);
    } else {
        console.log(colors.green("✓ Diagnostics completed. Your development environment is healthy and ready!"));
    }
    console.log(colors.cyan("============================================================\n"));
};

runDoctor().catch((err) => {
    console.error("Doctor script execution failed:", err);
    process.exit(1);
});
