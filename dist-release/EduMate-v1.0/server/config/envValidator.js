/**
 * EduMate Mission 12.5 — Production Environment Validator
 * 
 * Validates critical environment variables before startup to prevent silent runtime failures.
 */

const REQUIRED_ENV_VARS = [
    { name: "NODE_ENV", default: "development" },
    { name: "PORT", default: "5000", isNumeric: true },
    { name: "MONGODB_URI", required: true },
    { name: "JWT_SECRET", default: "edumate_jwt_default_secret_key_2026" },
    { name: "LLM_PROVIDER", default: "llama.cpp" },
    { name: "LLM_BASE_URL", default: "http://127.0.0.1:8080" },
    { name: "LLM_MODEL", default: "Qwen3-1.7B-Instruct-Q4_K_M.gguf" },
    { name: "QDRANT_URL", default: "http://127.0.0.1:6333" }
];

const validateEnvironment = () => {
    const missing = [];
    const warnings = [];

    for (const item of REQUIRED_ENV_VARS) {
        const val = process.env[item.name];

        if (!val || val.trim() === "") {
            if (item.required) {
                missing.push(item.name);
            } else if (item.default) {
                process.env[item.name] = item.default;
            }
        } else if (item.isNumeric && isNaN(Number(val))) {
            warnings.push(`Environment variable ${item.name} should be numeric, but got: "${val}"`);
        }
    }

    if (missing.length > 0) {
        console.error("\n❌ [FATAL] Missing required environment variables:");
        missing.forEach(v => console.error(`   - ${v}`));
        console.error("Please configure these in .env before launching EduMate.\n");
        return { valid: false, missing, warnings };
    }

    if (warnings.length > 0) {
        warnings.forEach(w => console.warn(`⚠️ [ENV WARNING] ${w}`));
    }

    return { valid: true, missing: [], warnings };
};

module.exports = {
    validateEnvironment,
    REQUIRED_ENV_VARS
};
