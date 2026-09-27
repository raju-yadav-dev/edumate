const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

const llamaProcessManager = require("../server/services/llamaProcessManager");
const { getLlmConfig } = require("../server/config/llm");

async function main() {
    console.log("============================================================");
    console.log("       EduMate Local llama.cpp Server Startup CLI           ");
    console.log("============================================================");

    const config = getLlmConfig();
    console.log(`Configured Model  : ${config.model}`);
    console.log(`Model Path        : ${config.modelFile.resolvedPath}`);
    console.log(`File Status       : ${config.modelFile.exists ? `✓ Found (${config.modelFile.sizeFormatted})` : "❌ Missing"}`);
    console.log(`Port              : ${config.port}`);
    console.log(`Context Size      : ${config.contextSize}`);
    console.log(`Threads           : ${config.threads}`);
    console.log(`GPU Layers        : ${config.gpuLayers}`);
    console.log(`Batch Size        : ${config.batchSize}`);
    console.log("------------------------------------------------------------");

    const result = await llamaProcessManager.startServer({ silent: false });

    if (result.success) {
        console.log(`\n✓ llama.cpp Server is ready and operational.`);
        console.log(`Endpoint: ${config.baseUrl}`);
        if (result.reused) {
            console.log(`Note: Reused existing active llama-server instance.`);
        } else {
            console.log(`Process ID: ${result.pid}`);
        }
    } else {
        console.error(`\n❌ Failed to start llama.cpp server:`, result.error || result.code);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error("Fatal startup error:", err);
        process.exit(1);
    });
}

module.exports = main;
