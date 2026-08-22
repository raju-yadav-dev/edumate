const fs = require("fs");
const path = require("path");

if (typeof global.document === "undefined") {
    const mockElement = {
        appendChild: () => {},
        setAttribute: () => {},
        style: {},
        sheet: {
            insertRule: () => {},
            cssRules: []
        },
        getElementsByTagName: () => [{
            appendChild: () => {}
        }],
        getContext: () => ({
            measureText: () => ({ width: 0 }),
            fillRect: () => {},
            drawImage: () => {},
            fillText: () => {},
            getImageData: () => ({
                data: [0, 0, 0, 0]
            })
        }),
        remove: () => {},
        removeChild: () => {}
    };
    global.document = {
        createElement: () => mockElement,
        getElementsByTagName: () => [mockElement],
        documentElement: mockElement,
        head: mockElement,
        body: mockElement
    };
}

if (typeof global.Image === "undefined") {
    global.Image = function() {
        // Trigger onload asynchronously to simulate image loaded immediately
        setTimeout(() => {
            if (this.onload) this.onload();
        }, 5);
    };
}

const pdfExtractor = require("../server/ai/utils/pdfExtractor");

const docsDir = path.join(__dirname, "../server/uploads/documents");

async function main() {
    if (!fs.existsSync(docsDir)) {
        console.log("Documents directory not found:", docsDir);
        return;
    }
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith(".pdf"));
    console.log(`Found ${files.length} PDF files. Scanning...`);
    
    for (const file of files) {
        const filePath = path.join(docsDir, file);
        const buffer = fs.readFileSync(filePath);
        try {
            const result = await pdfExtractor.extractText(buffer);
            const needsOcrPages = result.pages.filter(p => p.needsOcr).map(p => p.pageNumber);
            const hasImagePages = result.pages.filter(p => p.hasImage).map(p => p.pageNumber);
            
            console.log(`- File: ${file}`);
            console.log(`  Pages: ${result.numPages}`);
            console.log(`  Text length: ${result.pages.reduce((sum, p) => sum + p.text.length, 0)}`);
            console.log(`  Requires OCR: ${result.requiresOcr}`);
            console.log(`  Pages needing OCR: ${needsOcrPages.join(", ")}`);
            console.log(`  Pages with images: ${hasImagePages.join(", ")}`);
        } catch (err) {
            console.error(`  Failed to parse ${file}:`, err.message);
        }
    }
}

main().catch(console.error);
