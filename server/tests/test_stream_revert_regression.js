const assert = require('assert');
const { validateResponse } = require('../services/responseValidator');

console.log('============================================================');
console.log('TEST 1: responseValidator does not treat fee year (2026) as room number');
console.log('============================================================');

const feeChunk = {
    id: 'chunk-fee-1',
    content: 'COURSE: Bachelor of Computer Applications\nFEE CARD FOR SESSION 2026\nSemester 1: 77,200\nTotal: 4,82,600',
    metadata: {
        originalName: 'WhatsApp Image 2026-08-23 at 18.12.28 (1).jpeg',
        documentName: 'Fee Card 2026'
    }
};

const generatedFeeAnswer = `Based on the official fee structure for Bachelor of Computer Applications (BCA) for session 2026:
- Semester 1: 77,200
- Semester 2: 77,200
- Total Course Fee: 4,82,600`;

const valResult = validateResponse({
    question: 'What are the fees for BCA?',
    intent: 'FEE_QUERY',
    retrievedContext: { chunks: [feeChunk] },
    generatedAnswer: generatedFeeAnswer,
    providerSuccess: true,
    questionType: 'university_specific',
    sources: [{ documentTitle: 'Fee Card 2026', title: 'Fee Card 2026' }]
});

console.log('Validation valid:', valResult.valid);
console.log('Validation reason:', valResult.reason);
console.log('Grounded answer preview:', valResult.groundedAnswer.slice(0, 80));

assert.strictEqual(valResult.valid, true, 'Validation must be valid for fee answer');
assert.ok(!valResult.groundedAnswer.includes('Room'), 'Grounded answer must NOT convert fee response to room number');
assert.ok(valResult.groundedAnswer.includes('4,82,600'), 'Grounded answer must preserve fee amounts');
console.log('PASS: TEST 1 passed (no false room contradiction on fee cards)');

console.log('\n============================================================');
console.log('TEST 2: Chat streaming done handler preserves latest streamed text');
console.log('============================================================');

// Simulate the frontend logic from Chat.jsx onChunk "done"
function simulateChatDone({ streamedText, eventMessage, existingContent }) {
    let finalText = streamedText;
    const finalMessageText = (finalText && finalText.trim().length > 0) ? finalText : (eventMessage || '');
    finalText = finalMessageText;
    
    const updatedContent = finalMessageText || existingContent;
    return updatedContent;
}

// Case A: Correct response streamed, backend returns stale/conflicting event.message
const turn2Streamed = 'The eligibility for BCA requires 10+2 with minimum 50% marks.';
const turn1StaleMessage = 'The fees for BCA is 4,82,600 for 8 semesters.';

const resultA = simulateChatDone({
    streamedText: turn2Streamed,
    eventMessage: turn1StaleMessage,
    existingContent: ''
});

assert.strictEqual(resultA, turn2Streamed, 'Latest streamed response must NOT be overwritten by stale event.message');
console.log('PASS: Latest streamed text preserved over stale event.message');

// Case B: No stream (direct response), backend returns event.message
const directMessage = 'Direct response message';
const resultB = simulateChatDone({
    streamedText: '',
    eventMessage: directMessage,
    existingContent: ''
});

assert.strictEqual(resultB, directMessage, 'Direct message used when stream is empty');
console.log('PASS: Direct message preserved when stream is empty');

// Test 3: Branch activeChildMap functional update simulation
let activeChildMap = { root: 'u1', u1: 'a1' };
function updateActiveChildMap(updater) {
    activeChildMap = updater(activeChildMap);
}

// Simulate effect running with functional updater
const normalized = [
    { id: 'u1', parentId: null },
    { id: 'a1', parentId: 'u1' },
    { id: 'u2', parentId: 'a1' },
    { id: 'a2', parentId: 'u2' }
];

updateActiveChildMap(prevMap => {
    const map = { ...prevMap };
    let changed = false;
    const parentToChildren = {};
    normalized.forEach(msg => {
        const pId = msg.parentId || 'root';
        if (!parentToChildren[pId]) parentToChildren[pId] = [];
        parentToChildren[pId].push(msg);
    });
    Object.keys(parentToChildren).forEach(pId => {
        const children = parentToChildren[pId];
        if (children.length > 0) {
            if (!map[pId] || !children.some(c => c.id === map[pId])) {
                map[pId] = children[children.length - 1].id;
                changed = true;
            }
        }
    });
    return changed ? map : prevMap;
});

assert.strictEqual(activeChildMap['a1'], 'u2', 'a1 points to u2');
assert.strictEqual(activeChildMap['u2'], 'a2', 'u2 points to a2');
console.log('PASS: activeChildMap functional update successfully maintains Turn 2 path');

console.log('\nALL REGRESSION TESTS PASSED!');

