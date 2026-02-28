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
    const target = /const searchPromises = searchables\.map\(async \(schema\) => \{[\s\S]*?const combined = results\.flatMap\(r => r\.data \|\| \[\]\)\.slice\(0, 3\);/;
    const replacement = `const searchPromises = searchables.map(async (schema) => {
                    const searchableCols = ['name', 'full_name', 'asset_name', 'label', 'title', 'description'];
                    const results = await Promise.all(searchableCols.map(col => {
                        const subQ = supabase.from(schema.tableName).select(getRBACSelect(schema.tableName)).ilike(col, \`%\${query}%\`).limit(2);
                        return applyRBACFilter(subQ, schema.tableName, profile);
                    }));

                    const combined = results.flatMap(r => r.data || []).slice(0, 3);`;

    if (target.test(content)) {
        content = content.replace(target, replacement);
        fs.writeFileSync(omniPath, content);
        console.log('Fixed OmniSearch.tsx');
    } else {
        console.log('OmniSearch target not found');
    }
}

// 2. Global Import Replacement
walk(SRC_DIR, (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    if (filePath.includes('hooks\\useAuth.ts') || filePath.includes('hooks\\useToast.ts')) return;
    if (filePath.includes('contexts\\AuthContext.tsx') || filePath.includes('contexts\\ToastContext.tsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace useAuth imports
    content = content.replace(/import \{ useAuth \} from ['"].*?contexts\/AuthContext['"]/g, "import { useAuth } from '@/hooks/useAuth'");
    // Replace useToast imports
    content = content.replace(/import \{ useToast \} from ['"].*?contexts\/ToastContext['"]/g, "import { useToast } from '@/hooks/useToast'");

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(\`Updated imports in: \${filePath}\`);
    }
});
