const supabase = require("../server/config/supabase");
const logger = require("./logger");

/**
 * Checks connectivity and authorizations with the Supabase client
 * @returns {Promise<boolean>}
 */
const verifySupabase = async () => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_URL === "https://placeholder.supabase.co") {
        console.log(logger.cyan("ℹ️ Supabase not configured. Using local file storage."));
        return true;
    }

    console.log(logger.cyan("Verifying Supabase connection..."));
    
    try {
        const { error } = await supabase.storage.listBuckets();
        if (error) {
            throw error;
        }

        console.log(logger.green("✓ Supabase Storage connection verified successfully."));
        return true;
    } catch (err) {
        console.warn(logger.yellow(`⚠️ Supabase connection check warning: ${err.message}. Local storage fallback active.`));
        return true;
    }
};

module.exports = {
    verifySupabase
};
