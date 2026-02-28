import fs from 'fs';
import path from 'path';

const srcDir = './src';
const stateAudit = [];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') walk(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const useStates = (content.match(/const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*useState/g) || []);
            const useContexts = (content.match(/useContext\s*\(\s*(\w+)\s*\)/g) || []);

            if (useStates.length > 0 || useContexts.length > 0) {
                stateAudit.push({
                    file: fullPath,
                    states: useStates.map(s => s.match(/\[\s*(\w+)\s*,/)[1]),
                    contexts: useContexts.map(c => c.match(/\(\s*(\w+)\s*\)/)[1])
                });
            }
        }
    }
}

walk(srcDir);
fs.writeFileSync('state_dna_audit.json', JSON.stringify(stateAudit, null, 2));
console.log(`Audited ${stateAudit.length} files for state management.`);
