const supabase = require("../config/supabase");
const colors = require("./colors");

/**
 * Checks connectivity and authorizations with the Supabase client
 * @returns {Promise<boolean>}
 */
const verifySupabase = async () => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_URL === "https://placeholder.supabase.co") {
        console.log(colors.cyan("ℹ️ Supabase not configured. Using local file storage."));
        return true;
    }

    console.log(colors.cyan("Verifying Supabase connection..."));
    
    try {
        const { error } = await supabase.storage.listBuckets();
        if (error) {
            throw error;
        }

        console.log(colors.green("✓ Supabase Storage connection verified successfully."));
        return true;
    } catch (err) {
        console.warn(colors.yellow(`⚠️ Supabase connection check warning: ${err.message}. Local storage fallback active.`));
        return true;
    }
};

module.exports = {
    verifySupabase
};
