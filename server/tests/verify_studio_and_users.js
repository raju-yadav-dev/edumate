const assert = require("assert");
const path = require("path");
const fs = require("fs");

console.log("=== Running Verification: Knowledge Studio & User Management ===");

// 1. Verify Knowledge Studio files and Rebranding
const studioHtmlPath = path.join(__dirname, "..", "chunking-ui", "index.html");
assert.ok(fs.existsSync(studioHtmlPath), "Knowledge Studio index.html must exist");
const studioHtml = fs.readFileSync(studioHtmlPath, "utf8");
assert.ok(studioHtml.includes("EduMate Knowledge Studio"), "Header must be rebranded to EduMate Knowledge Studio");
assert.ok(!studioHtml.includes("Port 5001"), "Header should no longer reference legacy Port 5001");
console.log("✓ Knowledge Studio verified on disk with updated branding.");

// 2. Verify server/app.js mounts
const appCode = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.ok(appCode.includes('app.use("/studio"'), "app.js must mount /studio");
assert.ok(appCode.includes("chunkingServer"), "app.js must integrate chunkingServer runtime");
console.log("✓ Consolidated Port 5000 studio mounting verified in app.js.");

// 3. Verify chunkingServer does not auto-listen when required
const chunkingServerCode = fs.readFileSync(path.join(__dirname, "..", "chunkingServer.js"), "utf8");
assert.ok(chunkingServerCode.includes("require.main === module"), "chunkingServer must guard startup behind require.main === module");
assert.ok(!chunkingServerCode.includes('!req.headers.accept.includes("text/html")'), "chunkingServer must not hijack requests with wildcard Accept headers into json");
console.log("✓ chunkingServer.js lifecycle guard and HTML delivery verified.");

// 4. Verify authService.sanitizeUser includes lastLoginAt & createdAt
const { sanitizeUser } = require("../services/authService");
const dummyUser = {
    _id: "507f1f77bcf86cd799439011",
    fullName: "Test User",
    email: "test@edumate.edu",
    role: "admin",
    status: "active",
    lastLoginAt: new Date("2026-10-30T10:00:00Z"),
    createdAt: new Date("2026-10-01T10:00:00Z")
};
const sanitized = sanitizeUser(dummyUser);
assert.strictEqual(sanitized.fullName, "Test User");
assert.ok(sanitized.lastLoginAt instanceof Date, "lastLoginAt must be preserved in sanitizeUser");
assert.ok(sanitized.createdAt instanceof Date, "createdAt must be preserved in sanitizeUser");
console.log("✓ sanitizeUser properly outputs lastLoginAt and createdAt timestamps.");

// 5. Verify userService exports
const userService = require("../services/userService");
assert.strictEqual(typeof userService.listUsers, "function", "listUsers must be a function");
assert.strictEqual(typeof userService.updateUser, "function", "updateUser must be a function");
assert.strictEqual(typeof userService.createUser, "function", "createUser must be a function");
assert.strictEqual(typeof userService.deleteUser, "function", "deleteUser must be a function");
console.log("✓ userService CRUD handlers verified.");

// 6. Verify userController exports
const userController = require("../controllers/userController");
assert.strictEqual(typeof userController.listUsers, "function", "userController.listUsers must exist");
assert.strictEqual(typeof userController.updateUser, "function", "userController.updateUser must exist");
assert.strictEqual(typeof userController.createUser, "function", "userController.createUser must exist");
assert.strictEqual(typeof userController.deleteUser, "function", "userController.deleteUser must exist");
console.log("✓ userController endpoints verified.");

// 7. Verify Client Service and Pages
const clientServicePath = path.join(__dirname, "..", "..", "client", "src", "services", "userService.js");
assert.ok(fs.existsSync(clientServicePath), "Client userService.js must exist");
const clientPagePath = path.join(__dirname, "..", "..", "client", "src", "pages", "UserManagement", "UserManagement.jsx");
assert.ok(fs.existsSync(clientPagePath), "UserManagement.jsx page must exist");
const clientCssPath = path.join(__dirname, "..", "..", "client", "src", "pages", "UserManagement", "UserManagement.css");
assert.ok(fs.existsSync(clientCssPath), "UserManagement.css must exist");
console.log("✓ Client UserManagement page, CSS, and API services verified.");

// 8. Verify Studio Health and Base href
assert.ok(studioHtml.includes('<base href="/studio/">'), "index.html must have base href set to /studio/");
assert.ok(!appCode.includes('app.get("/health"'), "app.js must not shadow studio /health handler");
console.log("✓ Studio health handler routing and base href verified.");

console.log("\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
