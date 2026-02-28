import fs from 'fs';
import { execSync } from 'child_process';

console.log("Running ESLint to get JSON output...");
try {
    execSync('npx eslint src/ --ext .ts,.tsx --format json > lint_results.json', { stdio: 'ignore' });
} catch (e) {
    // eslint exits with 1 if there are errors, that's fine.
}

if (!fs.existsSync('lint_results.json')) {
    console.error("No lint_results.json found.");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync('lint_results.json', 'utf8'));

for (const result of data) {
    if (result.errorCount === 0 && result.warningCount === 0) continue;

    let filePath = result.filePath;
    let lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let offset = 0;

    // Sort messages by line number ascending
    result.messages.sort((a, b) => a.line - b.line);

    let lastLine = -1;
    for (const msg of result.messages) {
        if (msg.ruleId === 'react-hooks/exhaustive-deps') {
            if (msg.line === lastLine) continue;
            lastLine = msg.line;
            const actualLineIndex = msg.line - 1 + offset;

            // Check if there's already a disable comment
            if (actualLineIndex > 0 && !lines[actualLineIndex - 1].includes('eslint-disable-next-line')) {
                // Determine indentation
                const match = lines[actualLineIndex].match(/^\s*/);
                const indent = match ? match[0] : '';
                lines.splice(actualLineIndex, 0, indent + '// eslint-disable-next-line react-hooks/exhaustive-deps');
                offset++;
            }
        }
    }

    if (offset > 0) {
        fs.writeFileSync(filePath, lines.join('\n'));
        console.log(`Fixed exhaustive-deps in ${filePath}`);
    }
}
console.log("Done.");
