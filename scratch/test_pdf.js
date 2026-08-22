const fs = require('fs');
const path = require('path');
const pdfExtractor = require('../server/ai/utils/pdfExtractor');

async function test() {
    const pdfPath = 'd:\\HACKTHON\\edumate\\scratch\\courses_list.pdf';
    console.log('Reading PDF:', pdfPath);
    const buffer = fs.readFileSync(pdfPath);
    const result = await pdfExtractor.extractText(buffer);
    console.log('Result pages count:', result.pages.length);
    console.log('Requires OCR:', result.requiresOcr);
    console.log('First page length:', result.pages[0]?.text?.length);
    console.log('First 500 chars of page 1:', result.pages[0]?.text?.slice(0, 500));
}

test().catch(console.error);
