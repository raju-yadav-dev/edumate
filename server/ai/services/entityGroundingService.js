/**
 * Universal Entity-to-Fact Grounding Service for EduMate RAG
 * 
 * Generic, domain-agnostic grounding and record extraction:
 * 1. Identifies target entity and requested attributes from queries.
 * 2. Parses multi-record chunks (tables, key-values, lists, campus records) into atomic, isolated records.
 * 3. Prevents fact cross-contamination across records in the same chunk.
 * 4. Resolves follow-ups against active conversation branch memory.
 * 5. Handles missing/unverified facts with honest uncertainty.
 * 6. Establishes a shared EvidenceContract between retrieval, generator, and validator.
 */

const STOP_WORDS = new Set([
    "what", "is", "the", "for", "tell", "me", "show", "who", "where", "when", "why", "which",
    "are", "am", "a", "an", "of", "in", "on", "at", "to", "with", "by", "from", "and", "or",
    "about", "how", "much", "many", "does", "do", "can", "give", "please", "room", "number",
    "floor", "building", "located", "find", "get"
]);

// Attribute typo normalization map
const ATTRIBUTE_TYPOS = [
    [/\b(?:nuber|numbr|no\b|num\b)/gi, "number"],
    [/\b(?:rm\b)/gi, "room"],
    [/\b(?:bldng|bldg)\b/gi, "building"],
    [/\b(?:flr)\b/gi, "floor"]
];

/**
 * Extracts the target entity and requested attributes from a user question.
 */
function extractQueryTarget(question = "", conversationContext = null) {
    let raw = String(question || "").trim();
    for (const [pattern, repl] of ATTRIBUTE_TYPOS) {
        raw = raw.replace(pattern, repl);
    }
    const lower = raw.toLowerCase();

    // Attribute flags
    const asksBuilding = /\b(?:building|which\s+building|bhavan|block)\b/i.test(lower);
    const asksFloor = /\b(?:floor|which\s+floor|level)\b/i.test(lower);
    const asksRoom = /\b(?:room|room\s*(?:no\.?|number)?|which\s+room|office|cabin)\b/i.test(lower) ||
                     (/\bwhere\b/i.test(lower) && !asksBuilding && !asksFloor);
    const asksPerson = /\b(?:who|who's|name\s+of|person|head|hod|dean|faculty|professor|coordinator)\b/i.test(lower);
    const asksFees = /\b(?:fee|fees|cost|tuition|charge|charges)\b/i.test(lower);
    const asksDepartment = /\b(?:department|dept|school)\b/i.test(lower);
    const asksEligibility = /\b(?:eligibility|eligible|criteria|minimum\s+marks|requirements?)\b/i.test(lower);
    const asksDuration = /\b(?:duration|how\s+long|how\s+many\s+years|how\s+many\s+semesters)\b/i.test(lower);
    const asksCredits = /\b(?:credits?)\b/i.test(lower);

    // Extract target entity noun phrase from query
    let targetEntity = "";
    
    // Pattern 1: "Where is the [Entity]?" / "location of [Entity]"
    const whereMatch = lower.match(/\b(?:where\s+is(?:\s+the)?|location\s+of(?:\s+the)?|how\s+to\s+find(?:\s+the)?|find(?:\s+the)?)\s+([^?.,!]+)/i);
    if (whereMatch) {
        targetEntity = whereMatch[1].trim();
    }

    // Pattern 2: "What is the room number of [Entity]?" / "room of [Entity]" / "building of [Entity]" / "fees of [Entity]"
    if (!targetEntity) {
        const ofMatch = lower.match(/\b(?:room(?:\s+number)?|building|floor|office|head|hod|fee|fees|cost|eligibility|duration|details?)\s+(?:of|for|in)\s+(?:the\s+)?([^?,!]+)/i);
        if (ofMatch) {
            targetEntity = ofMatch[1].trim();
        }
    }

    // Pattern 3: "Which building is the [Entity] in?"
    if (!targetEntity) {
        const whichMatch = lower.match(/\bwhich\s+(?:building|floor|room)\s+is(?:\s+the)?\s+(.+?)(?:\s+in|\s+at|\s+located|\?|$)/i);
        if (whichMatch) {
            targetEntity = whichMatch[1].trim();
        }
    }

    // Pattern 4: "Who is the HOD of [Department]?"
    if (!targetEntity) {
        const hodMatch = lower.match(/\b(?:who\s+is\s+(?:the\s+)?hod\s+(?:of\s+)?|hod\s+(?:of\s+)?)([^?.,!]+)/i);
        if (hodMatch) {
            targetEntity = `HOD of ${hodMatch[1].trim()}`;
        }
    }

    // Pattern 5: Generic clean
    if (!targetEntity) {
        const clean = lower
            .replace(/\b(?:what|where|which|who|is|are|the|a|an|in|at|of|for|to|can|you|tell|me|about|room|number|floor|building|please)\b/gi, " ")
            .replace(/[?.,!]/g, "")
            .trim();
        if (clean.length > 2) {
            targetEntity = clean;
        }
    }

    // Clean up trailing words from targetEntity (e.g. "vfx lab in", "vfx lab?")
    targetEntity = targetEntity
        .replace(/\b(?:in|at|on|located|and|or|its|fees|fee)\s*$/i, "")
        .replace(/[?,!]/g, "")
        .trim();

    // Check if this is a follow-up referring to the last entity
    const isFollowUp = (
        !targetEntity ||
        targetEntity.length <= 2 ||
        /^(?:it|its|that|this|same|there)$/i.test(targetEntity) ||
        (/^(?:building|which building|floor|which floor|room|which room|what about room|fees|what about fees)$/i.test(lower.replace(/[?.,!]/g, "").trim()))
    );

    if (isFollowUp && conversationContext?.lastVerifiedEntity) {
        const prev = conversationContext.lastVerifiedEntity;
        targetEntity = prev.entity || prev.name || prev.department || targetEntity;
    }

    // Significant keyword tokens for entity matching
    const entityTokens = targetEntity
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

    return {
        targetEntity,
        entityTokens,
        attributes: {
            asksRoom,
            asksFloor,
            asksBuilding,
            asksPerson,
            asksFees,
            asksDepartment,
            asksEligibility,
            asksDuration,
            asksCredits
        },
        isFollowUp
    };
}

/**
 * Parses raw text from a chunk into distinct individual records.
 * Supports:
 * - Markdown & ASCII tables (rows & columns)
 * - Colon-delimited Key-Value pairs & bulleted lists
 * - Delimited campus room/building segments
 * - Standalone entity statements
 * Keeps all facts belonging to a single record strictly bound together.
 */
function parseChunkRecords(chunk) {
    if (!chunk) return [];
    const content = String(chunk.content || "");
    const metadata = chunk.metadata || {};
    const heading = String(metadata.heading || metadata.section || "");
    const filename = String(metadata.originalName || metadata.filename || metadata.documentName || "");
    const documentId = String(metadata.documentId || metadata.sourceDocumentId || chunk.id || "");
    const chunkId = String(chunk.id || metadata.chunkId || "");
    const pageNumber = Number(metadata.pageNumber || metadata.page || 1);

    // Identify building from filename or heading
    let defaultBuilding = null;
    const bldMatch = `${filename} ${heading} ${content}`.match(/\b(Building\s+[IVX0-9]+(?:\s*\([^)]+\))?|[A-Za-z]+(?:\s+[A-Za-z]+)?\s+bhavan)\b/i);
    if (bldMatch) {
        defaultBuilding = bldMatch[1].trim();
    } else if (/Building\s*I\b/i.test(filename)) {
        defaultBuilding = "Building I";
    } else if (/Building\s*II\b/i.test(filename)) {
        defaultBuilding = "Building II";
    }

    const rawLines = content.split("\n");
    const records = [];

    // 1. Table Detection: Markdown tables (| col1 | col2 |)
    const tableLines = rawLines.filter(l => l.trim().startsWith("|") && l.trim().endsWith("|"));
    if (tableLines.length >= 2) {
        let headers = [];
        let hasHeader = false;

        for (const tLine of tableLines) {
            const cells = tLine.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (!hasHeader) {
                headers = cells;
                hasHeader = true;
                continue;
            }
            if (/^[-:\s]+$/.test(cells.join(""))) {
                continue;
            }
            if (cells.length > 0) {
                const subject = cells[0];
                const attributes = {};
                cells.forEach((val, cIdx) => {
                    const headerKey = (headers[cIdx] || `col_${cIdx}`).toLowerCase().replace(/[^a-z0-9]/g, "_");
                    attributes[headerKey] = val;
                });

                const roomVal = attributes.room || attributes.room_no || attributes.room_number || null;
                const floorVal = attributes.floor || attributes.level || null;
                const bldVal = attributes.building || attributes.block || defaultBuilding;
                const deptVal = attributes.department || attributes.dept || null;

                records.push({
                    id: `${chunkId}_tbl_${records.length}`,
                    subject,
                    entity: subject,
                    room: roomVal,
                    floor: floorVal,
                    building: bldVal,
                    documentBuilding: defaultBuilding,
                    department: deptVal,
                    attributes,
                    text: tLine.trim(),
                    source: {
                        documentId,
                        filename,
                        pageNumber,
                        chunkId,
                        sectionHeading: heading || subject
                    },
                    chunkId,
                    documentId,
                    filename,
                    pageNumber
                });
            }
        }
        if (records.length > 0) {
            return records;
        }
    }

    let currentFloor = null;
    let currentDeptContext = null;

    // Check if heading established a floor or department
    const headingFloorMatch = heading.match(/\b([0-9]+(?:st|nd|rd|th)\s+floor|ground\s+floor|group\s+floor)\b/i);
    if (headingFloorMatch) {
        currentFloor = headingFloorMatch[1].trim();
    }

    for (const rawLine of rawLines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Check if line sets a floor context, e.g. "1st floor (Department of cyber science & technology)"
        const floorMatch = line.match(/^([0-9]+(?:st|nd|rd|th)\s+floor|ground\s+floor|group\s+floor)(?:\s*\(([^)]+)\))?/i);
        if (floorMatch) {
            currentFloor = floorMatch[1].trim().replace(/^group\s+floor$/i, "Ground floor");
            if (floorMatch[2]) {
                currentDeptContext = floorMatch[2].trim();
            }
            continue;
        }

        // Check for records starting with room number, e.g. "205 Photography Lab"
        // Also handles multiple room numbers on one line, e.g. "205 Photography Lab 206 3D and VFX lab 3rd floor..."
        const segmentRegex = /(?:^|\s+)([0-9]{3,4}[a-z]?)\s+([A-Za-z0-9&/,'’.\-()\s]+?)(?=(?:\s+[0-9]{3,4}[a-z]?\b)|$)/g;
        let match;
        let foundSegments = false;

        while ((match = segmentRegex.exec(line)) !== null) {
            foundSegments = true;
            const room = match[1].trim();
            let desc = match[2].trim();

            // Ignore 4-digit years (1900-2099)
            if (/^(?:19\d\d|20\d\d)$/.test(room)) continue;

            // Ignore street addresses and non-room numbers
            if (/^(?:road|street|lane|avenue|sarani|highway|nagar|sector|pin|kolkata|barasat|west bengal)\b/i.test(desc)) continue;

            // Ignore fee/academic headings
            if (/^(?:fee|fees|session|duration|semester|sem\b|course|admission|rs\.?|inr|total)\b/i.test(desc)) continue;

            let itemFloor = currentFloor;
            const itemFloorMatch = desc.match(/\b([0-9]+(?:st|nd|rd|th)\s+floor|ground\s+floor)\b/i);
            if (itemFloorMatch) {
                itemFloor = itemFloorMatch[1].trim();
                desc = desc.replace(itemFloorMatch[0], "").trim();
            }

            let itemDept = currentDeptContext;
            const deptMatch = desc.match(/\(([^)]+)\)/);
            if (deptMatch) {
                itemDept = deptMatch[1].trim();
                desc = desc.replace(deptMatch[0], "").trim();
            }

            desc = desc.replace(/^[0-9]{3,4}[a-z]?\s*[:-]?\s*/i, "").replace(/\s{2,}/g, " ").trim();

            const explicitBldMatch = `${rawLine}`.match(/\b(Building\s+[IVX0-9]+|[A-Za-z]+(?:\s+[A-Za-z]+)?\s+bhavan)\b/i);
            const explicitBuilding = explicitBldMatch ? explicitBldMatch[1].trim() : null;
            const effectiveBuilding = explicitBuilding || defaultBuilding;

            // Handle multi-entity descriptions separated by commas on the same room number
            // e.g. "102 windows service & virtualizations lab, Linux lab"
            const subEntities = desc.split(/,\s*(?=[A-Za-z0-9])/).map(s => s.trim()).filter(Boolean);

            const baseRecord = {
                id: `${chunkId}_rec_${records.length}`,
                room,
                entity: desc,
                subject: desc,
                text: `${room} ${desc}${itemFloor ? ` (${itemFloor})` : ""}`,
                floor: itemFloor,
                building: effectiveBuilding,
                documentBuilding: defaultBuilding,
                department: itemDept,
                attributes: {
                    room,
                    floor: itemFloor,
                    building: effectiveBuilding,
                    department: itemDept
                },
                source: {
                    documentId,
                    filename,
                    pageNumber,
                    chunkId,
                    sectionHeading: `${room} ${desc}`
                },
                chunkId,
                documentId,
                filename,
                pageNumber
            };
            records.push(baseRecord);

            // Push dedicated sub-records for comma-separated entities sharing the same room number
            if (subEntities.length > 1) {
                for (const sub of subEntities) {
                    if (sub !== desc) {
                        records.push({
                            id: `${chunkId}_sub_${records.length}`,
                            room,
                            entity: sub,
                            subject: sub,
                            text: `${room} ${sub}${itemFloor ? ` (${itemFloor})` : ""}`,
                            floor: itemFloor,
                            building: effectiveBuilding,
                            documentBuilding: defaultBuilding,
                            department: itemDept,
                            attributes: {
                                room,
                                floor: itemFloor,
                                building: effectiveBuilding,
                                department: itemDept
                            },
                            source: {
                                documentId,
                                filename,
                                pageNumber,
                                chunkId,
                                sectionHeading: `${room} ${sub}`
                            },
                            chunkId,
                            documentId,
                            filename,
                            pageNumber
                        });
                    }
                }
            }
        }

        // Standalone line (Key-Value, Bullet list, or Paragraph)
        if (!foundSegments) {
            const standaloneRoomMatch = line.match(/\b([0-9]{3,4}[a-z]?)\b/);
            const room = standaloneRoomMatch ? standaloneRoomMatch[1] : null;
            let cleanLine = line.replace(/^[0-9]{3,4}[a-z]?\s*[:-]?\s*/i, "").trim();

            const explicitBldMatch = `${line}`.match(/\b(Building\s+[IVX0-9]+|[A-Za-z]+(?:\s+[A-Za-z]+)?\s+bhavan)\b/i);
            const explicitBuilding = explicitBldMatch ? explicitBldMatch[1].trim() : null;
            const effectiveBuilding = explicitBuilding || defaultBuilding;

            const kvMatch = line.match(/^([^:-]+)[:\-]\s*(.+)$/);
            const attributes = {
                room,
                floor: currentFloor,
                building: effectiveBuilding,
                department: currentDeptContext
            };
            if (kvMatch) {
                const key = kvMatch[1].trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
                attributes[key] = kvMatch[2].trim();
            }

            records.push({
                id: `${chunkId}_line_${records.length}`,
                room,
                entity: cleanLine || line,
                subject: cleanLine || line,
                text: line,
                floor: currentFloor,
                building: effectiveBuilding,
                documentBuilding: defaultBuilding,
                department: currentDeptContext,
                attributes,
                source: {
                    documentId,
                    filename,
                    pageNumber,
                    chunkId,
                    sectionHeading: heading || cleanLine || line
                },
                chunkId,
                documentId,
                filename,
                pageNumber
            });
        }
    }

    // Include chunk heading as a record if distinct
    if (heading && heading !== "Document" && !records.some(r => r.text.includes(heading))) {
        const headingRoom = heading.match(/\b([0-9]{3,4}[a-z]?)\b/);
        const cleanHeadingEntity = heading.replace(/^[0-9]{3,4}[a-z]?\s*[:-]?\s*/i, "").trim();
        const explicitBldMatch = `${heading}`.match(/\b(Building\s+[IVX0-9]+|[A-Za-z]+(?:\s+[A-Za-z]+)?\s+bhavan)\b/i);
        const explicitBuilding = explicitBldMatch ? explicitBldMatch[1].trim() : null;
        const effectiveBuilding = explicitBuilding || defaultBuilding;

        records.unshift({
            id: `${chunkId}_heading`,
            room: headingRoom ? headingRoom[1] : null,
            entity: cleanHeadingEntity || heading,
            subject: cleanHeadingEntity || heading,
            text: heading,
            floor: currentFloor,
            building: effectiveBuilding,
            documentBuilding: defaultBuilding,
            department: currentDeptContext,
            attributes: {
                room: headingRoom ? headingRoom[1] : null,
                floor: currentFloor,
                building: effectiveBuilding,
                department: currentDeptContext
            },
            source: {
                documentId,
                filename,
                pageNumber,
                chunkId,
                sectionHeading: heading
            },
            chunkId,
            documentId,
            filename,
            pageNumber
        });
    }

    return records;
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const row = [];
    for (let i = 0; i <= b.length; i++) row[i] = i;

    for (let i = 1; i <= a.length; i++) {
        let prev = i;
        for (let j = 1; j <= b.length; j++) {
            let val;
            if (a[i - 1] === b[j - 1]) {
                val = row[j - 1];
            } else {
                val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
            }
            row[j - 1] = prev;
            prev = val;
        }
        row[b.length] = prev;
    }
    return row[b.length];
}

function isFuzzyTokenMatch(token, targetWord) {
    if (!token || !targetWord) return false;
    const t = String(token).toLowerCase();
    const w = String(targetWord).toLowerCase();
    if (t === w || w.includes(t) || t.includes(w)) return true;
    if (Math.abs(t.length - w.length) > 2) return false;

    const dist = levenshtein(t, w);
    if (t.length >= 5 && dist <= 2) return true;
    if (t.length >= 4 && dist <= 1) return true;
    return false;
}

/**
 * Finds the record that best matches the target entity from parsed chunk records.
 * Uses generic token overlap, typo tolerance, and specificity scoring with zero hardcoded entities.
 */
function findBestMatchingRecord(records = [], targetEntity = "", entityTokens = []) {
    if (!Array.isArray(records) || records.length === 0) return null;
    const targetLower = String(targetEntity || "").toLowerCase().trim();

    let bestRecord = null;
    let highestScore = -1;

    const GENERIC_ENTITY_WORDS = new Set([
        "lab", "laboratory", "office", "cabin", "room", "department", "center", "centre",
        "hall", "studio", "building", "cell", "division", "section"
    ]);
    const nonGenericTokens = entityTokens.filter(t => !GENERIC_ENTITY_WORDS.has(t));

    for (const rec of records) {
        const entityLower = (rec.entity || rec.subject || "").toLowerCase();
        const textLower = (rec.text || "").toLowerCase();
        const recWords = `${entityLower} ${textLower}`.split(/[\s,.\-_/()]+/).filter(Boolean);
        let score = 0;

        // 1. Exact or substring match for complete target entity phrase
        if (targetLower && (entityLower.includes(targetLower) || textLower.includes(targetLower))) {
            score += 12.0;
        }

        // 2. Token overlap score with typo-tolerant fuzzy matching
        let matchedSpecificTokens = 0;
        let matchedGenericTokens = 0;
        for (const token of entityTokens) {
            const isGeneric = GENERIC_ENTITY_WORDS.has(token);
            const hasExact = entityLower.includes(token) || textLower.includes(token);
            const hasFuzzy = hasExact || recWords.some(w => isFuzzyTokenMatch(token, w));
            if (hasFuzzy) {
                if (isGeneric) {
                    matchedGenericTokens++;
                } else {
                    matchedSpecificTokens++;
                }
            }
        }

        // 3. Specificity enforcement:
        if (nonGenericTokens.length > 0) {
            if (matchedSpecificTokens === 0) {
                score -= 20.0;
            } else {
                score += (matchedSpecificTokens * 8.0) + (matchedGenericTokens * 1.0);

                const recSpecificWords = recWords.filter(w => !GENERIC_ENTITY_WORDS.has(w) && w.length >= 4);
                const extraSpecificWords = recSpecificWords.filter(rw => 
                    !entityTokens.some(t => isFuzzyTokenMatch(t, rw))
                );
                if (extraSpecificWords.length > 0) {
                    score -= Math.min(extraSpecificWords.length * 1.5, 4.0);
                }
            }
        } else {
            score += matchedGenericTokens * 2.0;
        }

        if (score > highestScore) {
            highestScore = score;
            bestRecord = rec;
        }
    }

    return highestScore > 0 ? bestRecord : null;
}

/**
 * Builds clean, demarcated context for LLM prompt with strict record boundaries.
 */
function formatDemarcatedContext(chunks = [], targetEntity = "") {
    if (!Array.isArray(chunks) || chunks.length === 0) return "";

    const docBlocks = [];
    const seenRecords = new Set();

    for (const chunk of chunks) {
        const records = parseChunkRecords(chunk);
        if (records.length === 0) continue;

        const filename = chunk.metadata?.originalName || chunk.metadata?.filename || "University Document";
        const page = chunk.metadata?.pageNumber || 1;
        const formattedLines = [];

        for (const rec of records) {
            const key = `${rec.room}-${rec.entity}-${rec.floor}`.toLowerCase();
            if (seenRecords.has(key)) continue;
            seenRecords.add(key);

            const parts = [];
            if (rec.room) parts.push(`Room: ${rec.room}`);
            parts.push(`Entity: ${rec.entity || rec.subject || rec.text}`);
            if (rec.floor) parts.push(`Floor: ${rec.floor}`);
            if (rec.department) parts.push(`Department: ${rec.department}`);
            if (rec.building) parts.push(`Building: ${rec.building}`);

            if (rec.attributes) {
                for (const [k, v] of Object.entries(rec.attributes)) {
                    if (!["room", "floor", "building", "department", "entity", "subject"].includes(k) && v) {
                        parts.push(`${k}: ${v}`);
                    }
                }
            }

            formattedLines.push(`• Record: ${parts.join(" | ")}`);
        }

        if (formattedLines.length > 0) {
            docBlocks.push(`[Source Document: ${filename} | Page: ${page}]\n${formattedLines.join("\n")}`);
        }
    }

    return docBlocks.join("\n\n");
}

/**
 * Constructs an authoritative, grounded natural language answer from verified entity records.
 */
function groundEntityResponse({
    question = "",
    targetEntity = "",
    bestRecord = null,
    attributes = {},
    conversationContext = null,
    modelAnswer = ""
}) {
    if (!bestRecord) {
        return null;
    }

    const { room, floor, building, documentBuilding, entity, attributes: recordAttrs = {} } = bestRecord;
    const { asksRoom, asksFloor, asksBuilding, asksPerson, asksFees, asksEligibility, asksDuration } = attributes;

    let entityName = entity || targetEntity || "The requested location";
    if (targetEntity && entity && entity.toLowerCase().includes(targetEntity.toLowerCase())) {
        entityName = targetEntity.replace(/\b\w/g, c => c.toUpperCase());
    } else if (entity) {
        entityName = entity;
    }

    const effectiveBuilding = building || documentBuilding;

    // Update conversationContext with verified entity facts
    if (conversationContext) {
        conversationContext.lastVerifiedEntity = {
            entity: entityName,
            name: entityName,
            room: room || null,
            floor: floor || null,
            building: effectiveBuilding || null,
            department: bestRecord.department || null,
            documentId: bestRecord.documentId,
            filename: bestRecord.filename,
            pageNumber: bestRecord.pageNumber,
            chunkId: bestRecord.chunkId
        };
    }

    // Question: "Which building is the VFX lab in?" / Genuine follow-up "Which building?"
    if (asksBuilding && !asksRoom && !asksFloor) {
        if (effectiveBuilding) {
            const roomSuffix = room ? ` (Room ${room})` : "";
            return `The ${entityName}${roomSuffix} is located in ${effectiveBuilding}.`;
        } else {
            const roomSuffix = room ? ` (Room ${room})` : "";
            return `The building for ${entityName}${roomSuffix} is not specified in the official documents.`;
        }
    }

    // Question: "Which floor is the VFX lab on?" / Genuine follow-up "Which floor?"
    if (asksFloor && !asksRoom && !asksBuilding) {
        if (floor) {
            const roomSuffix = room ? ` (Room ${room})` : "";
            return `The ${entityName}${roomSuffix} is on the ${floor}.`;
        } else {
            const roomSuffix = room ? ` (Room ${room})` : "";
            return `The floor for ${entityName}${roomSuffix} is not specified in the official documents.`;
        }
    }

    // Question: "What is the room number and floor of the VFX lab?"
    if (asksRoom && asksFloor && !asksBuilding && !/\bwhere\b/i.test(question)) {
        if (room && floor) {
            return `The ${entityName} is in Room ${room} on the ${floor}.`;
        } else if (room && !floor) {
            return `The ${entityName} is in Room ${room}. The floor is not specified in the official documents.`;
        } else if (!room && floor) {
            return `The ${entityName} is on the ${floor}. The room number is not specified in the official documents.`;
        }
    }

    // Question: "What is the room number of Photography Lab?"
    if (asksRoom && !asksFloor && !asksBuilding && !/\bwhere\b/i.test(question)) {
        if (room) {
            return `The room number for ${entityName} is ${room}.`;
        } else {
            return `The room number for ${entityName} is not specified in the official university records.`;
        }
    }

    // Question: "Who is the HOD of Psychology?"
    if (asksPerson) {
        const bldSuffix = effectiveBuilding ? ` (${effectiveBuilding})` : "";
        if (room) {
            return `The HOD of ${bestRecord.department || targetEntity.replace(/^hod\s+(?:of\s+)?/i, "")} is located in Room ${room}${bldSuffix}. The specific name of the HOD is not specified in the official documents.`;
        } else {
            return `The specific name of the HOD is not specified in the official documents.`;
        }
    }

    // Question: Fees
    if (asksFees) {
        const feeVal = recordAttrs.fee || recordAttrs.fees || recordAttrs.tuition || recordAttrs.cost;
        if (feeVal) {
            return `The fee structure for ${entityName} is ${feeVal}.`;
        }
    }

    // Question: Eligibility
    if (asksEligibility) {
        const eligVal = recordAttrs.eligibility || recordAttrs.criteria || recordAttrs.requirements;
        if (eligVal) {
            return `The eligibility criteria for ${entityName} are: ${eligVal}.`;
        }
    }

    // Question: "Where is the Photography Lab?" / "Where is the VFX lab?"
    // Strictly report room and floor as established in the record itself without inventing unestablished attributes
    const parts = [];
    if (room) parts.push(`Room ${room}`);
    if (floor) parts.push(`on the ${floor}`);
    if (building) parts.push(`in ${building}`);

    if (parts.length > 0) {
        return `The ${entityName} is located in ${parts.join(" ")}.`;
    }

    return `The ${entityName} is listed in official university records.`;
}

/**
 * Shared Evidence-to-Answer Contract
 */
class EvidenceContract {
    constructor({
        question = "",
        targetSubject = "",
        entityTokens = [],
        requestedAttributes = {},
        records = [],
        matchedRecord = null,
        conversationContext = null
    }) {
        this.question = question;
        this.targetSubject = targetSubject;
        this.entityTokens = entityTokens;
        this.requestedAttributes = requestedAttributes;
        this.records = records;
        this.matchedRecord = matchedRecord;
        this.conversationContext = conversationContext;
    }

    hasEvidence() {
        return Boolean(this.matchedRecord || (this.records && this.records.length > 0));
    }

    validateClaim(attribute, value) {
        if (!this.matchedRecord) return { valid: false, reason: "No evidence found for subject" };
        const recordVal = this.matchedRecord[attribute] || (this.matchedRecord.attributes && this.matchedRecord.attributes[attribute]);
        if (!recordVal) {
            return { valid: false, reason: `Attribute "${attribute}" is not established in the evidence` };
        }
        const match = String(recordVal).toLowerCase().trim() === String(value).toLowerCase().trim();
        return { valid: match, expected: recordVal, actual: value };
    }

    formatGroundedAnswer() {
        return groundEntityResponse({
            question: this.question,
            targetEntity: this.targetSubject,
            bestRecord: this.matchedRecord,
            attributes: this.requestedAttributes,
            conversationContext: this.conversationContext
        });
    }
}

/**
 * Builds the shared EvidenceContract for a query and retrieved chunks.
 */
function buildEvidenceContract({ question = "", chunks = [], conversationContext = null }) {
    const queryTarget = extractQueryTarget(question, conversationContext);
    const allRecords = [];
    if (Array.isArray(chunks)) {
        for (const chunk of chunks) {
            allRecords.push(...parseChunkRecords(chunk));
        }
    }
    const matchedRecord = queryTarget.targetEntity 
        ? findBestMatchingRecord(allRecords, queryTarget.targetEntity, queryTarget.entityTokens)
        : null;

    return new EvidenceContract({
        question,
        targetSubject: queryTarget.targetEntity,
        entityTokens: queryTarget.entityTokens,
        requestedAttributes: queryTarget.attributes,
        records: allRecords,
        matchedRecord,
        conversationContext
    });
}

module.exports = {
    extractQueryTarget,
    parseChunkRecords,
    findBestMatchingRecord,
    formatDemarcatedContext,
    groundEntityResponse,
    EvidenceContract,
    buildEvidenceContract
};
