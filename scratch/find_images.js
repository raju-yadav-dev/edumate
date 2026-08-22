const fs = require("fs");
const path = require("path");

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (!file.startsWith(".") && file !== "node_modules") {
                results = results.concat(walk(fullPath));
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const images = walk(path.join(__dirname, ".."));
console.log(`Found ${images.length} images:`);
images.slice(0, 10).forEach(img => {
    console.log(`- ${path.relative(path.join(__dirname, ".."), img)}`);
});
