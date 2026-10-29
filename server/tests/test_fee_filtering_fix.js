const assert = require('assert');
const { buildPlannerQdrantFilter } = require('../ai/services/retrievalService');
const { mapCategoryToDocumentType } = require('../ai/utils/normalization');
const { planQuery } = require('../ai/utils/queryPlanner');

console.log('=== TEST 1: normalization.js mapCategoryToDocumentType ===');
assert.strictEqual(mapCategoryToDocumentType('fees'), 'Fee Structure');
assert.strictEqual(mapCategoryToDocumentType('fee'), 'Fee Structure');
assert.strictEqual(mapCategoryToDocumentType('fee structure'), 'Fee Structure');
assert.strictEqual(mapCategoryToDocumentType('admissions'), 'admission');
console.log('PASS: mapCategoryToDocumentType maps fees/fee/fee structure to Fee Structure');

console.log('\n=== TEST 2: Qdrant filter includes fees category and documentType aliases ===');
const plan = planQuery('What is the total fee for BCA?');
const qdrantFilter = buildPlannerQdrantFilter({ queryPlan: plan });

// Extract category should values
const catClause = qdrantFilter.must.find(c => c.should && c.should.some(s => s.key === 'category'));
const catValues = catClause.should.map(s => s.match.value);
console.log('Category Should Values:', catValues);
assert(catValues.includes('fees'), 'Category filter must include fees');
assert(catValues.includes('fee'), 'Category filter must include fee');
console.log('PASS: Category filter contains fees and fee');

// Extract documentType should values
const dtClause = qdrantFilter.must.find(c => c.should && c.should.some(s => s.key === 'documentType'));
const dtValues = dtClause.should.map(s => s.match.value);
console.log('DocumentType Should Values:', dtValues);
assert(dtValues.includes('fees'), 'DocumentType filter must include fees');
assert(dtValues.includes('fee'), 'DocumentType filter must include fee');
assert(dtValues.includes('fee structure'), 'DocumentType filter must include fee structure');
console.log('PASS: DocumentType filter contains fees, fee, and fee structure');

console.log('\n=== TEST 3: Synthetic Chunk Matching ===');
// Simulate chunks with legacy or folder-derived metadata
const chunk1 = { category: 'fees', documentType: 'fees' };
const chunk2 = { category: 'fees', documentType: 'Fee Structure' };
const chunk3 = { category: 'Admissions', documentType: 'fees' };

function matchesFilter(chunk, filter) {
    for (const clause of filter.must) {
        if (clause.should) {
            const matched = clause.should.some(s => {
                if (s.key === 'category') return s.match.value.toLowerCase() === chunk.category.toLowerCase();
                if (s.key === 'documentType') return s.match.value.toLowerCase() === chunk.documentType.toLowerCase();
                return true; // ignore program/dept for this assertion
            });
            if (!matched) return false;
        }
    }
    return true;
}

assert(matchesFilter(chunk1, qdrantFilter), 'Chunk 1 (category: fees, docType: fees) must match filter');
assert(matchesFilter(chunk2, qdrantFilter), 'Chunk 2 (category: fees, docType: Fee Structure) must match filter');
assert(matchesFilter(chunk3, qdrantFilter), 'Chunk 3 (category: Admissions, docType: fees) must match filter');
console.log('PASS: All fee chunk variants pass the initial Qdrant filter!');

console.log('\nALL FOCUSED TESTS PASSED SUCCESSFULLY.');

