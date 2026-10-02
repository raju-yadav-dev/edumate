const fs = require('fs');
const path = require('path');

const storageDir = path.resolve(__dirname, '../storage');

// 1. Ensure File Explorer folder exists
const fileExplorerDir = path.join(storageDir, 'File Explorer');
if (!fs.existsSync(fileExplorerDir)) {
    fs.mkdirSync(fileExplorerDir, { recursive: true });
    console.log('Created: storage/File Explorer');
} else {
    console.log('Exists: storage/File Explorer');
}

// 2. Renaming mappings
const renames = {
    'Building Floor Plan': 'building_floor_plans',
    'broucher': 'brochures',
    'Diploma': 'diploma',
    'PG_doc': 'pg_documents',
    'UG_doc': 'ug_documents'
};

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

for (const [oldName, newName] of Object.entries(renames)) {
    const oldPath = path.join(storageDir, oldName);
    const newPath = path.join(storageDir, newName);

    if (fs.existsSync(oldPath)) {
        if (!fs.existsSync(newPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`Renamed: ${oldName} -> ${newName}`);
        } else {
            copyDirRecursive(oldPath, newPath);
            fs.rmSync(oldPath, { recursive: true, force: true });
            console.log(`Merged and removed: ${oldName} -> ${newName}`);
        }
    }
}
console.log('Storage folders updated successfully.');
