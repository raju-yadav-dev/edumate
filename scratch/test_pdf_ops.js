const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");

const pdfPath = path.join(__dirname, "../server/uploads/documents/09cd3457-534d-4279-9b05-02f9302779fc.pdf");

async function main() {
    if (!fs.existsSync(pdfPath)) {
        console.log("PDF file not found:", pdfPath);
        return;
    }
    const buffer = fs.readFileSync(pdfPath);
    
    const renderPage = async (pageData) => {
        console.log(`\nPage ${pageData.pageNumber} properties:`);
        console.log("- Keys:", Object.keys(pageData));
        
        const operatorList = await pageData.getOperatorList();
        console.log("- OperatorList keys:", Object.keys(operatorList));
        console.log("- fnArray length:", operatorList.fnArray.length);
        
        // Let's count different operations
        const opCounts = {};
        for (const fnId of operatorList.fnArray) {
            opCounts[fnId] = (opCounts[fnId] || 0) + 1;
        }
        console.log("- Op counts:", opCounts);
        
        return "";
    };
    
    await pdfParse(buffer, { pagerender: renderPage });
}

main().catch(console.error);
