require("dotenv").config();

const supabase = require("./config/supabase");

async function testSupabase() {

    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error("❌ Error:", error.message);
        return;
    }

    console.log("✅ Connected Successfully");
    console.table(data);

}

testSupabase();