const { execSync } = require("child_process");
const logger = require("./logger");

const runFormat = () => {
    logger.info("🎨 Running code formatting tool (Prettier)...");
    try {
        execSync('npx prettier --write "client/src/**/*.{js,jsx,css,html}" "server/**/*.js" "scripts/**/*.js" "*.json" "*.md" --ignore-unknown', { stdio: "inherit", shell: true });
        logger.success("✓ Code formatting complete.");
    } catch (e) {
        logger.warn(`⚠️ Formatting warning: Prettier run failed. Make sure Prettier is available or resolve syntax errors. Details: ${e.message}`);
    }
};

runFormat();
