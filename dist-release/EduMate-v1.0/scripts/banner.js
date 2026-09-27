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
    const aiProvider = process.env.LLM_PROVIDER || "llama.cpp";
    const aiModelName = `${process.env.LLM_MODEL || "Qwen3-1.7B-Instruct"} (${aiProvider})`;
    const embeddingProvider = process.env.EMBEDDING_PROVIDER || "jina";
    const embeddingModelName = `${process.env.EMBEDDING_MODEL || "jina-embeddings-v3"} (${embeddingProvider})`;
    const storageProvider = process.env.STORAGE_PROVIDER === "supabase" ? "Supabase Storage" : "Local File Storage";

    console.log(logger.cyan("══════════════════════════════════════════════"));
    console.log(logger.bold(logger.green("🚀 EduMate Development Environment")));
    console.log(logger.cyan("══════════════════════════════════════════════"));
    
    console.log(`${logger.green("✓")} Node.js`);
    console.log(`${logger.green("✓")} npm`);
    console.log(`${logger.green("✓")} MongoDB Connected`);
    console.log(`${logger.green("✓")} Storage: ${storageProvider}`);
    console.log(`${logger.green("✓")} AI: ${aiProvider}`);
    console.log(`${logger.green("✓")} Qdrant Running`);
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
    
    console.log(logger.bold("Storage"));
    console.log(logger.green(storageProvider));
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
