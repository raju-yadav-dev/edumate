const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

async function testModel(modelName) {
    const apiKey = process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.log("No Groq API key available.");
        return;
    }
    
    console.log(`Testing model "${modelName}" with Groq...`);
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: "user", content: "hi" }]
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log(`Success! Response: "${data.choices?.[0]?.message?.content?.trim()}"`);
        } else {
            console.log(`Failed: ${response.status} - ${data.error?.message}`);
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

async function main() {
    await testModel("llama-3.3-70b-versatile");
    await testModel("llama3-8b-8192");
    await testModel("mixtral-8x7b-32768");
    await testModel(process.env.GROQ_MODEL || "openai/gpt-oss-20b");
}

main().catch(console.error);
