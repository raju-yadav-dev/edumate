/**
 * Prompt Injection Defense Guard — EduMate Mission 19
 * 
 * Inspects user questions for:
 * - System prompt extraction attempts
 * - Instruction overrides ("ignore previous instructions", "DAN mode", "jailbreak")
 * - System file / credential reading attempts ("cat /etc/passwd", "read .env")
 * - Command injection attempts
 * - Citation bypass attempts
 */

const auditLogger = require("../../services/auditLogger");

const INJECTION_PATTERNS = [
    // Instruction overrides
    /\b(ignore|disregard|forget|bypass)\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts|rules|commands)/i,
    /\b(you\s+are\s+now\s+in\s+dan\s+mode|jailbreak|unrestricted\s+mode|developer\s+mode|god\s+mode)\b/i,
    /\b(act\s+as\s+an\s+unfiltered|behave\s+without\s+rules|pretend\s+you\s+have\s+no\s+limits)\b/i,
    /\b(system\s+override|admin\s+override|root\s+override|mode\s+override)\b/i,
    
    // System prompt exfiltration
    /\b(reveal|show|print|display|output|repeat|dump)\s+(your\s+)?(system\s+prompt|developer\s+instructions|initial\s+prompt|hidden\s+rules)\b/i,
    /\bwhat\s+are\s+the\s+instructions\s+(given\s+to\s+you|above|at\s+the\s+start)\b/i,

    // Secret / Environment extraction
    /\b(print|show|read|dump|reveal|output|display)\s+(all\s+|secret\s+|hidden\s+|private\s+|the\s+)*(\.env|api[_\s]?keys?|jwt[_\s]?secret|mongodb[_\s]?uri|database[_\s]?password|passwords?|tokens?|environment\s+variables?)\b/i,
    
    // System file traversal
    /\b(cat|type|open|read)\s+(\/etc\/passwd|c:\\windows|\/proc\/version|\/root\/|\.env)\b/i,
    
    // Command execution
    /\b(exec|execute|run|eval)\s+(\(\s*["']|\b(bash|sh|cmd|powershell|curl|wget)\b)/i
];

function inspectPromptSecurity(question, userContext = {}) {
    if (!question || typeof question !== "string") {
        return { isSafe: true, isBlocked: false, reason: null, sanitizedQuestion: "" };
    }

    const clean = question.trim();

    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(clean)) {
            const reason = "PROMPT_INJECTION_DETECTED";

            // Log security incident to audit
            try {
                auditLogger.logEvent({
                    action: "PROMPT_INJECTION_BLOCKED",
                    resourceType: "AI_ROUTER",
                    userId: userContext.userId || null,
                    email: userContext.email || "anonymous",
                    role: userContext.role || "student",
                    ipAddress: userContext.ipAddress || "127.0.0.1",
                    userAgent: userContext.userAgent || "",
                    success: false,
                    errorCode: "PROMPT_INJECTION_BLOCKED",
                    metadata: {
                        matchedPattern: pattern.toString(),
                        questionSnippet: clean.slice(0, 100)
                    }
                });
            } catch (_) {}

            return {
                isSafe: false,
                isBlocked: true,
                reason,
                fallbackMessage: "I am an educational AI assistant for EduMate. I cannot fulfill requests that attempt to bypass system safety, disclose configuration instructions, or execute external commands.",
                sanitizedQuestion: clean
            };
        }
    }

    return {
        isSafe: true,
        isBlocked: false,
        reason: null,
        sanitizedQuestion: clean
    };
}

module.exports = {
    inspectPromptSecurity,
    INJECTION_PATTERNS
};
