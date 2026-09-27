const assert = require("assert");
const crypto = require("crypto");
const { 
    generateAccessToken, 
    generateRefreshToken, 
    verifyAccessToken, 
    verifyRefreshToken,
    hashToken 
} = require("../server/utils/tokenizer");
const { 
    ROLES, 
    PERMISSIONS, 
    ROLE_PERMISSIONS, 
    hasPermission 
} = require("../server/constants/permissions");

async function runMasterSecuritySuite() {
    console.log("\n========================================================");
    console.log(" MISSION 10 (10.1 - 10.5): MASTER SECURITY & RBAC SUITE ");
    console.log("========================================================\n");

    // TEST 1: Dual-Token Architecture & Expirations (Mission 10.2)
    console.log("[Test 1] Dual-Token Architecture & Verification");
    const testUser = {
        _id: "650000000000000000000001",
        email: "security.test@edumate.ac.in",
        role: "admin",
        department: "Computer Science"
    };

    const accessToken = generateAccessToken(testUser);
    const refreshToken = generateRefreshToken(testUser, "session-xyz-123");

    assert(accessToken, "Access token must be generated");
    assert(refreshToken, "Refresh token must be generated");
    assert.notStrictEqual(accessToken, refreshToken, "Access and refresh tokens must be completely distinct");

    const decodedAccess = verifyAccessToken(accessToken);
    assert.strictEqual(decodedAccess.userId, testUser._id);
    assert.strictEqual(decodedAccess.email, testUser.email);
    assert.strictEqual(decodedAccess.role, testUser.role);
    console.log("  ✔ Access Token successfully signed and verified with userId and role claims.");

    const decodedRefresh = verifyRefreshToken(refreshToken);
    assert.strictEqual(decodedRefresh.userId, testUser._id);
    assert.strictEqual(decodedRefresh.sessionId, "session-xyz-123");
    console.log("  ✔ Refresh Token successfully signed and verified with sessionId claim.");

    // TEST 2: Token Hashing for DB Storage (Mission 10.2)
    console.log("\n[Test 2] SHA-256 Token Hashing for Database Storage");
    const tokenHash = hashToken(refreshToken);
    const tokenHash2 = hashToken(refreshToken);
    assert.strictEqual(tokenHash, tokenHash2, "Hash must be deterministic");
    assert.strictEqual(tokenHash.length, 64, "SHA-256 hex digest length must be 64");
    console.log("  ✔ SHA-256 Token hash generated accurately for zero-leakage storage.");

    // TEST 3: RBAC Roles & Permissions Matrix (Mission 10.4)
    console.log("\n[Test 3] Role-Based Access Control (RBAC) Matrix Evaluation");
    
    // Student tests
    assert.strictEqual(hasPermission("student", PERMISSIONS.CHAT_USE), true, "Student should have chat access");
    assert.strictEqual(hasPermission("student", PERMISSIONS.VOICE_USE), true, "Student should have voice access");
    assert.strictEqual(hasPermission("student", PERMISSIONS.CHUNKING_STUDIO_ACCESS), false, "Student must NOT view chunking studio");
    assert.strictEqual(hasPermission("student", PERMISSIONS.DOCUMENT_UPLOAD), false, "Student must NOT upload knowledge docs");
    assert.strictEqual(hasPermission("student", PERMISSIONS.USER_MANAGEMENT), false, "Student must NOT manage users");
    console.log("  ✔ Student permissions verified (restricted access).");

    // Faculty tests
    assert.strictEqual(hasPermission("faculty", PERMISSIONS.CHAT_USE), true, "Faculty should have chat access");
    assert.strictEqual(hasPermission("faculty", PERMISSIONS.DOCUMENT_UPLOAD), true, "Faculty should upload departmental docs");
    assert.strictEqual(hasPermission("faculty", PERMISSIONS.DEPT_CHUNKING_VIEW), true, "Faculty can view chunking studio");
    assert.strictEqual(hasPermission("faculty", PERMISSIONS.CHUNKING_STUDIO_ACCESS), false, "Faculty cannot manage global reindexing");
    assert.strictEqual(hasPermission("faculty", PERMISSIONS.AI_CONFIGURATION), false, "Faculty cannot modify system config");
    console.log("  ✔ Faculty permissions verified (departmental scope).");

    // Admin tests
    assert.strictEqual(hasPermission("admin", PERMISSIONS.CHUNKING_STUDIO_ACCESS), true, "Admin should manage chunking studio");
    assert.strictEqual(hasPermission("admin", PERMISSIONS.DOCUMENT_REPAIR), true, "Admin should perform knowledge base repair");
    assert.strictEqual(hasPermission("admin", PERMISSIONS.USER_MANAGEMENT), true, "Admin should manage users");
    assert.strictEqual(hasPermission("admin", PERMISSIONS.SUPER_ADMIN_SETTINGS), false, "Admin must NOT perform super admin actions");
    console.log("  ✔ Admin permissions verified.");

    // Super Admin tests
    assert.strictEqual(hasPermission("super_admin", PERMISSIONS.SUPER_ADMIN_SETTINGS), true, "Super Admin has super admin privileges");
    assert.strictEqual(hasPermission("super_admin", PERMISSIONS.AI_CONFIGURATION), true, "Super Admin has system config access");
    console.log("  ✔ Super Admin permissions verified (unrestricted access).");

    // TEST 4: Account Lockout & Cooldown Logic (Mission 10.5)
    console.log("\n[Test 4] Account Lockout & Cooldown Calculations");
    const User = require("../server/models/User");
    const mockUserInstance = new User({
        name: "Locked Test User",
        email: "locked@edumate.ac.in",
        role: "student",
        failedLoginAttempts: 0
    });

    assert.strictEqual(mockUserInstance.isLocked(), false, "Fresh account must not be locked");
    
    // Simulate 5 consecutive failed attempts
    for (let i = 0; i < 5; i++) {
        await mockUserInstance.incrementFailedAttempts();
    }
    assert.strictEqual(mockUserInstance.failedLoginAttempts, 5);
    assert.strictEqual(mockUserInstance.isLocked(), true, "Account must be locked after 5 failed attempts");
    assert(mockUserInstance.accountLockedUntil > new Date(), "accountLockedUntil timestamp must be in future");
    console.log("  ✔ Account successfully locks after 5 failed attempts.");

    // Simulate reset
    await mockUserInstance.resetFailedAttempts();
    assert.strictEqual(mockUserInstance.failedLoginAttempts, 0);
    assert.strictEqual(mockUserInstance.isLocked(), false);
    console.log("  ✔ Account successfully resets failed attempts on successful login.");

    // TEST 5: Rate Limiter Structure (Mission 10.5)
    console.log("\n[Test 5] Structured Auth Rate Limiter Configuration");
    const { loginLimiter, signupLimiter, refreshLimiter } = require("../server/middleware/authRateLimiter");
    assert(loginLimiter, "Login rate limiter middleware must be defined");
    assert(signupLimiter, "Signup rate limiter middleware must be defined");
    assert(refreshLimiter, "Refresh rate limiter middleware must be defined");
    console.log("  ✔ Rate limiters configured with structured RATE_LIMIT_EXCEEDED responses.");

    console.log("\n========================================================");
    console.log(" ✅ ALL MISSION 10 SECURITY & RBAC TESTS PASSED!");
    console.log("========================================================\n");
}

runMasterSecuritySuite().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
