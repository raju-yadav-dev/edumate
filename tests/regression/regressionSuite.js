/**
 * Regression Test Suite — Mission 18
 * 
 * Automatically runs previous mission test suites:
 * - Mission 16 (Hybrid Router Suite)
 * - Mission 17 (10-Layer Smart Cache Suite)
 * Aggregates results into single regression matrix.
 */

const { execSync } = require("child_process");
const path = require("path");

async function runRegressionSuite() {
    const report = {
        name: "Historical Regression Test Matrix",
        timestamp: new Date().toISOString(),
        totalSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        suites: []
    };

    const rootDir = path.join(__dirname, "..", "..");

    const testScripts = [
        {
            name: "Mission 16 — Hybrid LLM-First Router Suite",
            command: "node server/scripts/testMission16RouterSuite.js",
            file: "server/scripts/testMission16RouterSuite.js"
        },
        {
            name: "Mission 17 — 10-Layer Smart Cache Architecture Suite",
            command: "node server/scripts/testMission17CacheSuite.js",
            file: "server/scripts/testMission17CacheSuite.js"
        }
    ];

    report.totalSuites = testScripts.length;

    for (const test of testScripts) {
        const start = Date.now();
        try {
            const output = execSync(test.command, {
                cwd: rootDir,
                encoding: "utf-8",
                timeout: 30000
            });

            const durationMs = Date.now() - start;
            report.passedSuites++;
            report.suites.push({
                name: test.name,
                status: "PASSED",
                durationMs,
                output: output.trim()
            });
        } catch (err) {
            const durationMs = Date.now() - start;
            report.failedSuites++;
            report.suites.push({
                name: test.name,
                status: "FAILED",
                durationMs,
                error: err.message,
                output: (err.stdout || "") + "\n" + (err.stderr || "")
            });
        }
    }

    return report;
}

if (require.main === module) {
    runRegressionSuite().then(res => {
        console.log(`Regression Matrix: ${res.passedSuites}/${res.totalSuites} Suites Passed`);
    });
}

module.exports = { runRegressionSuite };
