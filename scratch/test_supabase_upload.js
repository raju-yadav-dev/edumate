const path = require("path");
const supabase = require("../server/config/supabase");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || "documents";

async function testUpload(mimeType, ext) {
    const filename = `test_upload_${Date.now()}${ext}`;
    const storagePath = `courses/${filename}`;
    const mockBuffer = Buffer.from("mock image data");
    
    console.log(`Testing Supabase upload of ${ext} file with contentType: "${mimeType}"...`);
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, mockBuffer, {
                contentType: mimeType,
                upsert: false
            });
            
        if (error) {
            console.log(`Failed: ${error.message}`);
        } else {
            console.log(`Success! Path: ${data.path}`);
            // Cleanup
            await supabase.storage.from(BUCKET).remove([storagePath]);
            console.log("Cleaned up uploaded test file.");
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
    console.log("----------------------------------------");
}

async function main() {
    console.log(`Target Bucket: ${BUCKET}`);
    await testUpload("image/jpeg", ".jpeg");
    await testUpload("image/png", ".png");
    await testUpload("application/pdf", ".jpeg");
    await testUpload("application/pdf", ".pdf");
}

main().catch(console.error);
