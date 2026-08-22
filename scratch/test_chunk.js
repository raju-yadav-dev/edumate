const fs = require('fs');
const path = require('path');
const pdfExtractor = require('../server/ai/utils/pdfExtractor');
const { RecursiveCharacterTextSplitter } = require('../server/ai/utils/chunkDocument');

async function test() {
    const pdfPath = 'd:\\HACKTHON\\edumate\\scratch\\courses_list.pdf';
    console.log('Reading PDF:', pdfPath);
    const buffer = fs.readFileSync(pdfPath);
    const result = await pdfExtractor.extractText(buffer);
    console.log('Pages parsed:', result.pages.length);
    
    const splitter = new RecursiveCharacterTextSplitter();
    const allChunks = [];
    
    for (const page of result.pages) {
        console.log(`Splitting page ${page.pageNumber} text length: ${page.text.length}`);
        const pageChunks = splitter.splitText(page.text || "");
        console.log(`Page ${page.pageNumber} returned ${pageChunks.length} chunks`);
        pageChunks.forEach((chunk, i) => {
            console.log(`  Chunk ${i}: length ${chunk.length}`);
            allChunks.push(chunk);
        });
    }
    
    console.log('Total chunks:', allChunks.length);
}

test().catch(console.error);
