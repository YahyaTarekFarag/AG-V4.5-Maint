import fs from 'fs';
import path from 'path';

const srcDir = './src';
const supabaseCalls = [];

function auditFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Regex for basic supabase operations
    const fromRegex = /supabase\s*\.\s*from\s*\(\s*['"](.+?)['"]\s*\)/g;
    const rpcRegex = /supabase\s*\.\s*rpc\s*\(\s*['"](.+?)['"]\s*/g;

    let match;
    while ((match = fromRegex.exec(content)) !== null) {
        const table = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;

        // Find the full chain (select, insert, update)
        const contextEnd = Math.min(content.length, match.index + 500);
        const codeContext = content.substring(match.index, contextEnd);

        supabaseCalls.push({
            type: 'TABLE_OP',
            file: filePath,
            line: lineNum,
            table: table,
            context: codeContext.split('\n').slice(0, 5).join('\n').trim()
        });
    }

    while ((match = rpcRegex.exec(content)) !== null) {
        const funcName = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;
        supabaseCalls.push({
            type: 'RPC_CALL',
            file: filePath,
            line: lineNum,
            function: funcName
        });
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') walk(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            auditFile(fullPath);
        }
    }
}

walk(srcDir);
fs.writeFileSync('supabase_calls_audit.json', JSON.stringify(supabaseCalls, null, 2));
console.log(`Audited ${supabaseCalls.length} Supabase calls.`);
