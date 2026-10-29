/**
 * Optional Supabase Storage Client Adapter
 * Safe fallback when @supabase/supabase-js is not installed
 */

let createClient = null;
try {
    createClient = require("@supabase/supabase-js").createClient;
} catch (_) {}

const dummyStorage = {
    from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        createSignedUrl: async () => ({ data: { signedUrl: "" } })
    })
};

const dummyClient = {
    storage: dummyStorage
};

let supabase = dummyClient;
let crawlerSupabase = dummyClient;

if (createClient && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
        supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    } catch (_) {}
}

const crawlerKey = process.env.CRAWLER_SUPABASE_SERVICE_ROLE_KEY || process.env.CRAWLER_SUPABASE_SERVICE_KEY;
if (createClient && process.env.CRAWLER_SUPABASE_URL && crawlerKey) {
    try {
        crawlerSupabase = createClient(process.env.CRAWLER_SUPABASE_URL, crawlerKey);
    } catch (_) {}
}

module.exports = supabase;
module.exports.crawlerSupabase = crawlerSupabase;
