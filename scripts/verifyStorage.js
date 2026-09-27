const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const localStorageManager = require("../server/storage/localStorageManager");

/**
 * Checks connectivity and permissions of EduMate Local Storage Root (`storage/`)
 * @returns {Promise<boolean>}
 */
const verifyStorage = async () => {
    try {
        const storageRoot = localStorageManager.ensureStorageRoot();
        
        // Test write and delete permissions
        const testFile = path.join(storageRoot, ".health_check.tmp");
        fs.writeFileSync(testFile, "storage_check_ok", "utf8");
        fs.unlinkSync(testFile);

        const stats = localStorageManager.getLocalStorageStats();
        console.log(logger.green(`✓ Local Storage operational at ${stats.rootPath} (${stats.files} files, ${stats.folders} folders, ${stats.usedFormatted} used).`));
        return true;
    } catch (err) {
        console.error(logger.red(`❌ Storage verification failed: ${err.message}`));
        return false;
    }
};

module.exports = {
    verifyStorage
};
