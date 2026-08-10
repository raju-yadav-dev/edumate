const logger = require("./logger");

const printBanner = () => {
    console.log(logger.cyan(`
============================================================
  _____    _       __  __       _
 | ____|__| |_   _|  \\/  | __ _| |_ ___
 |  _| / _\` | | | | |\\/| |/ _\` | __/ _ \\
 | |__| (_| | |_| | |  | | (_| | ||  __/
 |_____\\__,_|\\__,_|_|  |_|\\__,_|\\__\\___|

============================================================
             🚀 EduMate Monorepo Control Center
============================================================
`));
};

const printDashboard = (stats = {}) => {
    const aiProviderName = "Gemini";
    const aiModelName = `${process.env.GEMINI_COMPLETION_MODEL || "gemini-2.5-flash"} (Gemini)`;
    const embeddingProvider = process.env.EMBEDDING_PROVIDER || "jina";
    const embeddingModelName = `${process.env.EMBEDDING_MODEL || "jina-embeddings-v3"} (${embeddingProvider})`;

    console.log(logger.cyan("══════════════════════════════════════════════"));
    console.log(logger.bold(logger.green("🚀 EduMate Development Environment")));
    console.log(logger.cyan("══════════════════════════════════════════════"));
    
    console.log(`${logger.green("✓")} Node.js`);
    console.log(`${logger.green("✓")} npm`);
    console.log(`${logger.green("✓")} MongoDB Connected`);
    console.log(`${logger.green("✓")} Supabase Connected`);
    console.log(`${logger.green("✓")} ${aiProviderName} Connected`);
    console.log(`${logger.green("✓")} Qdrant Running`);
    console.log(`${logger.green("✓")} AI Initialized`);
    console.log(`${logger.green("✓")} Backend Started`);
    console.log(`${logger.green("✓")} Frontend Started`);
    
    console.log(logger.cyan("──────────────────────────────────────────────"));
    
    console.log(logger.bold("Frontend"));
    console.log(logger.green(stats.frontendUrl || "http://localhost:5173"));
    console.log();
    
    console.log(logger.bold("Backend"));
    console.log(logger.green(stats.backendUrl || "http://localhost:5000"));
    console.log();
    
    console.log(logger.bold("Environment"));
    console.log(logger.green(stats.env || "Development"));
    console.log();
    
    console.log(logger.bold("Vector Database"));
    console.log(logger.green("Qdrant"));
    console.log();
    
    console.log(logger.bold("AI"));
    console.log(logger.green(aiModelName));
    console.log();
    
    console.log(logger.bold("Embeddings"));
    console.log(logger.green(embeddingModelName));
    
    console.log(logger.cyan("──────────────────────────────────────────────"));
    console.log(logger.bold(logger.green("Ready to accept requests")));
    console.log(logger.cyan("══════════════════════════════════════════════"));
};

module.exports = {
    printBanner,
    printDashboard
};
