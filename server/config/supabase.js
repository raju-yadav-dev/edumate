const { createClient } = require("@supabase/supabase-js");
const { withTimeoutAndRetry } = require("../utils/fetchHelper");

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_key";

const wrapStorage = (storageInstance) => {
    return new Proxy(storageInstance, {
        get(target, prop) {
            const val = target[prop];
            if (prop === "from") {
                return function (bucketName) {
                    const bucket = val.call(target, bucketName);
                    return new Proxy(bucket, {
                        get(bucketTarget, bucketProp) {
                            const bucketVal = bucketTarget[bucketProp];
                            if (typeof bucketVal === "function") {
                                return function (...args) {
                                    return withTimeoutAndRetry(
                                        () => bucketVal.apply(bucketTarget, args),
                                        30000,
                                        3,
                                        1500,
                                        `Supabase.storage.from("${bucketName}").${bucketProp}`
                                    );
                                };
                            }
                            return bucketVal;
                        }
                    });
                };
            }
            if (typeof val === "function") {
                return function (...args) {
                    return withTimeoutAndRetry(
                        () => val.apply(target, args),
                        30000,
                        3,
                        1500,
                        `Supabase.storage.${prop}`
                    );
                };
            }
            return val;
        }
    });
};

const wrapClient = (clientInstance) => {
    return new Proxy(clientInstance, {
        get(target, prop) {
            const val = target[prop];
            if (prop === "storage") {
                return wrapStorage(val);
            }
            if (typeof val === "function") {
                return function (...args) {
                    return withTimeoutAndRetry(
                        () => val.apply(target, args),
                        30000,
                        3,
                        1500,
                        `Supabase.${prop}`
                    );
                };
            }
            return val;
        }
    });
};

const rawSupabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);
const supabase = wrapClient(rawSupabase);

let crawlerSupabase = supabase;
const crawlerKey = process.env.CRAWLER_SUPABASE_SERVICE_ROLE_KEY || process.env.CRAWLER_SUPABASE_SERVICE_KEY;
if (process.env.CRAWLER_SUPABASE_URL && crawlerKey) {
    const rawCrawlerSupabase = createClient(
        process.env.CRAWLER_SUPABASE_URL,
        crawlerKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
    crawlerSupabase = wrapClient(rawCrawlerSupabase);
}

module.exports = supabase;
module.exports.crawlerSupabase = crawlerSupabase;