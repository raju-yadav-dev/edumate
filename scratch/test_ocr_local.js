const fs = require("fs");
const path = require("path");
const ImageExtractor = require("../server/crawler/extractors/ImageExtractor");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    const imagePath = path.join(__dirname, "../client/src/assets/hero.png");
    if (!fs.existsSync(imagePath)) {
        console.error("Local test image not found:", imagePath);
        return;
    }
    
    console.log(`Loading image from: ${imagePath}`);
    const buffer = fs.readFileSync(imagePath);
    
    console.log("Calling ImageExtractor.extract...");
    try {
        const result = await ImageExtractor.extract(buffer);
        console.log("Success!");
        console.log(`- Extracted text length: ${result.text.length}`);
        console.log(`- Extracted text preview: "${result.text.substring(0, 200)}"`);
        console.log(`- Metadata:`, JSON.stringify(result.metadata, null, 2));
    } catch (err) {
        console.error("Extraction failed:", err);
    }
}

main().catch(console.error);
