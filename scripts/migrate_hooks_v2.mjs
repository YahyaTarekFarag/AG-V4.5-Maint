import fs from 'fs';
import path from 'path';

const SRC_DIR = 'c:\\AG V4.5\\src';

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

// 1. Fix OmniSearch.tsx
const omniPath = path.join(SRC_DIR, 'components/layout/OmniSearch.tsx');
if (fs.existsSync(omniPath)) {
    let content = fs.readFileSync(omniPath, 'utf8');
    const targetIndicator = 'const searchPromises = searchables.map(async (schema) => {';
    const endIndicator = 'const combined = results.flatMap(r => r.data || []).slice(0, 3);';

    const startIndex = content.indexOf(targetIndicator);
    const endIndex = content.indexOf(endIndicator);

    if (startIndex !== -1 && endIndex !== -1) {
        const head = content.substring(0, startIndex);
        const tail = content.substring(endIndex);
        const replacement = `const searchPromises = searchables.map(async (schema) => {
                    const searchableCols = ['name', 'full_name', 'asset_name', 'label', 'title', 'description'];
                    const results = await Promise.all(searchableCols.map(col => {
                        const subQ = supabase.from(schema.tableName).select(getRBACSelect(schema.tableName)).ilike(col, \`%\${query}%\`).limit(2);
                        return applyRBACFilter(subQ, schema.tableName, profile);
                    }));

                    `;

        fs.writeFileSync(omniPath, head + replacement + tail);
        console.log('Fixed OmniSearch.tsx via string splice');
    } else {
        console.log('OmniSearch indicators not found');
    }
}

// 2. Global Import Replacement
walk(SRC_DIR, (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    if (filePath.includes('hooks\\useAuth.ts') || filePath.includes('hooks\\useToast.ts')) return;
    if (filePath.includes('contexts\\AuthContext.tsx') || filePath.includes('contexts\\ToastContext.tsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Use string replacements for robustness
    const replacements = [
        ["'@/contexts/AuthContext'", "'@/hooks/useAuth'"],
        ["'../../contexts/AuthContext'", "'@/hooks/useAuth'"],
        ["'./contexts/AuthContext'", "'@/hooks/useAuth'"],
        ["'../contexts/AuthContext'", "'@/hooks/useAuth'"],
        ["'@/contexts/ToastContext'", "'@/hooks/useToast'"],
        ["'../../contexts/ToastContext'", "'@/hooks/useToast'"],
        ["'./contexts/ToastContext'", "'@/hooks/useToast'"],
        ["'../contexts/ToastContext'", "'@/hooks/useToast'"]
    ];

    for (const [from, to] of replacements) {
        content = content.replace(new RegExp(from, 'g'), to);
        // Also handle double quotes
        const fromDouble = from.replace(/'/g, '"');
        const toDouble = to.replace(/'/g, '"');
        content = content.replace(new RegExp(fromDouble, 'g'), toDouble);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log('Updated imports in: ' + filePath);
    }
});
