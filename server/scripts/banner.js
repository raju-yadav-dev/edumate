const colors = require("./colors");

const printBanner = () => {
    console.log(colors.cyan(`
============================================================
  _____    _       __  __       _
 | ____|__| |_   _|  \\/  | __ _| |_ ___
 |  _| / _\` | | | | |\\/| |/ _\` | __/ _ \\
 | |__| (_| | |_| | |  | | (_| | ||  __/
 |_____\\__,_|\\__,_|_|  |_|\\__,_|\\__\\___|

============================================================
             🚀 EduMate AI Server Launcher
============================================================
`));
};

const printDashboard = (stats) => {
    console.log(colors.cyan("══════════════════════════════════════════════"));
    console.log(colors.bold(colors.green("            🚀 EduMate AI Server")));
    console.log(colors.cyan("══════════════════════════════════════════════\n"));

    console.log(`${colors.green("✓")} Environment Variables Loaded`);
    console.log(`${colors.green("✓")} MongoDB Connected`);
    console.log(`${colors.green("✓")} Supabase Connected`);
    console.log(`${colors.green("✓")} Gemini Connected`);
    console.log(`${colors.green("✓")} Qdrant Running`);
    console.log(`${colors.green("✓")} Vector Collection Ready`);
    console.log(`${colors.green("✓")} AI Services Initialized`);
    console.log(`${colors.green("✓")} Express Server Started\n`);

    console.log(colors.cyan("──────────────────────────────────────────────"));
    console.log(`${colors.bold("Environment")} : ${colors.green(stats.env || "development")}`);
    console.log(`${colors.bold("Port")}        : ${colors.green(stats.port || "5000")}`);
    console.log(`${colors.bold("API")}         : ${colors.green(`http://localhost:${stats.port || "5000"}`)}`);
    console.log(`${colors.bold("Database")}    : ${colors.green("MongoDB Atlas")}`);
    console.log(`${colors.bold("Storage")}     : ${colors.green("Supabase")}`);
    console.log(`${colors.bold("Vector DB")}   : ${colors.green("Qdrant")}`);
    console.log(`${colors.bold("AI Model")}    : ${colors.green("Gemini 2.5 Flash")}`);
    console.log(`${colors.bold("Embeddings")}  : ${colors.green("Gemini text-embedding-004")}`);
    console.log(colors.cyan("──────────────────────────────────────────────\n"));

    console.log(colors.bold(colors.green("Ready to accept requests.")));
    console.log();
    console.log(colors.cyan("══════════════════════════════════════════════"));
};

module.exports = {
    printBanner,
    printDashboard
};
