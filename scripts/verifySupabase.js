const supabase = require("../server/config/supabase");
const logger = require("./logger");

/**
 * Checks connectivity and authorizations with the Supabase client
 * @returns {Promise<boolean>}
 */
const verifySupabase = async () => {
    console.log(logger.cyan("Verifying Supabase connection..."));
    
    try {
        // Query buckets to test client authorization & URL health
        const { error } = await supabase.storage.listBuckets();
        if (error) {
            throw error;
        }

        console.log(logger.green("✓ Supabase Storage connection verified successfully."));
        return true;
    } catch (err) {
        console.error(logger.red(`❌ Error: Supabase authorization/connection check failed: ${err.message}`));
        return false;
    }
};

module.exports = {
    verifySupabase
};
