const supabase = require("../config/supabase");
const colors = require("./colors");

/**
 * Checks connectivity and authorizations with the Supabase client
 * @returns {Promise<boolean>}
 */
const verifySupabase = async () => {
    console.log(colors.cyan("Verifying Supabase connection..."));
    
    try {
        // Query buckets to test client authorization & URL health
        const { error } = await supabase.storage.listBuckets();
        if (error) {
            throw error;
        }

        console.log(colors.green("✓ Supabase Storage connection verified successfully."));
        return true;
    } catch (err) {
        console.error(colors.red(`❌ Error: Supabase authorization/connection check failed: ${err.message}`));
        return false;
    }
};

module.exports = {
    verifySupabase
};
