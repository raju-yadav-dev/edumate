const logger = require("./logger");

const printBanner = () => {
    console.log(logger.cyan(`
================================================================================
  _____    _       __  __       _       
 | ____|__| |_   _|  \\/  | __ _| |_ ___ 
 |  _| / _\` | | | | |\\/| |/ _\` | __/ _ \\
 | |__| (_| | |_| | |  | | (_| | ||  __/
 |_____\\__,_|\\__,_|_|  |_|\\__,_|\\__\\___|

================================================================================
             🚀 EduMate AI Monorepo Control Center
================================================================================
`));
};

const printControlCenter = (options = {}) => {
    const version = options.version || "v1.0 Production";
    const env = options.env || (process.env.NODE_ENV === "production" ? "Production" : "Development");
    const port = process.env.PORT || "5000";
    const chunkingPort = process.env.CHUNKING_PORT || "5001";
    const llamaPort = process.env.LLAMA_PORT || "8080";
    const qdrantPort = process.env.QDRANT_PORT || "6333";

    const isMongoOk = options.mongoConnected !== false;
    const isQdrantOk = options.qdrantConnected !== false;
    const isLlamaOk = options.llamaReady !== false;
    const storageType = options.storageType || "Local Storage";
    const isCacheOk = options.cacheEnabled !== false;
    const workerStatus = options.workerStatus || "Idle";

    const dot = "●";

    console.log(logger.cyan("================================================================================"));
    console.log(logger.bold(logger.green("🎓 EduMate AI Platform — Development Control Center")));
    console.log(logger.cyan(`Version: ${logger.bold(version)}`));
    console.log(logger.cyan(`Environment: ${logger.bold(env)}`));
    console.log(logger.cyan("================================================================================"));
    console.log(logger.bold(logger.yellow("SERVICES")));
    console.log(`Frontend         → ${logger.cyan("http://localhost:5173")}`);
    console.log(`Backend API      → ${logger.cyan(`http://localhost:${port}`)}`);
    console.log(`Knowledge Studio → ${logger.cyan(`http://localhost:5173/admin`)}`);
    console.log(`LLM API          → ${logger.cyan(`http://localhost:${llamaPort}/v1`)}`);
    console.log(`Qdrant Dashboard → ${logger.cyan(`http://localhost:${qdrantPort}/dashboard`)}`);
    console.log(`Health API       → ${logger.cyan(`http://localhost:${port}/api/health`)}`);
    console.log(`Knowledge Health → ${logger.cyan(`http://localhost:${port}/api/documents/queue/health`)}`);
    console.log(logger.cyan("================================================================================"));
    console.log(logger.bold(logger.yellow("SYSTEM STATUS")));
    console.log(`MongoDB     ${isMongoOk ? logger.green(`${dot} Connected`) : logger.red(`${dot} Disconnected`)}`);
    console.log(`Qdrant      ${isQdrantOk ? logger.green(`${dot} Connected`) : logger.red(`${dot} Disconnected`)}`);
    console.log(`llama.cpp   ${isLlamaOk ? logger.green(`${dot} Ready`) : logger.yellow(`${dot} Offline`)}`);
    console.log(`Storage     ${logger.green(`${dot} ${storageType}`)}`);
    console.log(`Smart Cache ${isCacheOk ? logger.green(`${dot} Enabled`) : logger.yellow(`${dot} Disabled`)}`);
    console.log(`Worker      ${logger.green(`${dot} ${workerStatus}`)}`);
    console.log(logger.cyan("================================================================================"));
    console.log(logger.bold(logger.green("READY TO ACCEPT REQUESTS")));
    console.log(logger.cyan("================================================================================\n"));
};

const printDashboard = (stats = {}) => {
    printControlCenter(stats);
};

module.exports = {
    printBanner,
    printControlCenter,
    printDashboard
};
