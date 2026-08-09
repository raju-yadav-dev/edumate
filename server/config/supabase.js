const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_key";

const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

let crawlerSupabase = supabase;
if (process.env.CRAWLER_SUPABASE_URL && process.env.CRAWLER_SUPABASE_SERVICE_KEY) {
    crawlerSupabase = createClient(
        process.env.CRAWLER_SUPABASE_URL,
        process.env.CRAWLER_SUPABASE_SERVICE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
}

module.exports = supabase;
module.exports.crawlerSupabase = crawlerSupabase;