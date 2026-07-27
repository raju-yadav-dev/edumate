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
    const isOllama = process.env.LLM_PROVIDER === "ollama";
    const aiProviderName = isOllama ? "Ollama" : "Gemini";
    const aiModelName = isOllama ? `${process.env.OLLAMA_MODEL || "llama3.2:3b"} (Ollama)` : "Gemini 2.5 Flash";
    const embeddingModelName = isOllama ? `${process.env.OLLAMA_EMBEDDING_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b"} (Ollama)` : "Gemini text-embedding-004";

    console.log(colors.cyan("══════════════════════════════════════════════"));
    console.log(colors.bold(colors.green("            🚀 EduMate AI Server")));
    console.log(colors.cyan("══════════════════════════════════════════════\n"));

    console.log(`${colors.green("✓")} Environment Variables Loaded`);
    console.log(`${colors.green("✓")} MongoDB Connected`);
    console.log(`${colors.green("✓")} Supabase Connected`);
    console.log(`${colors.green("✓")} ${aiProviderName} Connected`);
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
    console.log(`${colors.bold("AI Model")}    : ${colors.green(aiModelName)}`);
    console.log(`${colors.bold("Embeddings")}  : ${colors.green(embeddingModelName)}`);
    console.log(colors.cyan("──────────────────────────────────────────────\n"));

    console.log(colors.bold(colors.green("Ready to accept requests.")));
    console.log();
    console.log(colors.cyan("══════════════════════════════════════════════"));
};

module.exports = {
    printBanner,
    printDashboard
};
