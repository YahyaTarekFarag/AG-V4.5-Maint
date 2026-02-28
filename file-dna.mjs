import fs from 'fs';
import path from 'path';

const srcDir = './src';
const results = [];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                walk(fullPath);
            }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            const supabaseCalls = (content.match(/supabase\.(from|rpc|auth|storage)/g) || []).length;
            const imports = (content.match(/^import .* from/gm) || []).length;

            let complexity = 'بسيط';
            if (lines.length > 300) complexity = 'متوسط';
            if (lines.length > 600) complexity = 'معقد';
            if (supabaseCalls > 5 || lines.length > 1000) complexity = 'حرج';

            results.push({
                name: file,
                path: fullPath,
                lines: lines.length,
                last_modified: stat.mtime,
                supabase_calls: supabaseCalls,
                imports_count: imports,
                complexity: complexity
            });
        }
    }
}

walk(srcDir);
fs.writeFileSync('file_dna_report.json', JSON.stringify(results, null, 2));
console.log("File DNA Generated: file_dna_report.json");
