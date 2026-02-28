const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            walk(filepath, callback);
        } else if (filepath.endsWith('.ts') || filepath.endsWith('.tsx')) {
            callback(filepath);
        }
    }
}

function updateImports(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    // Replace @/ aliases
    content = content.replace(/@\/components\/ui\//g, '@shared/components/ui/');
    content = content.replace(/@\/components\/layout\//g, '@shared/components/layout/');
    content = content.replace(/@\/hooks\//g, '@shared/hooks/');
    content = content.replace(/@\/lib\//g, '@shared/lib/');

    // Replace relative paths
    content = content.replace(/['"](?:\.\.\/|\.\/)+components\/ui\/(.*?)['"]/g, "'@shared/components/ui/$1'");
    content = content.replace(/['"](?:\.\.\/|\.\/)+components\/layout\/(.*?)['"]/g, "'@shared/components/layout/$1'");
    content = content.replace(/['"](?:\.\.\/|\.\/)+hooks\/(.*?)['"]/g, "'@shared/hooks/$1'");
    content = content.replace(/['"](?:\.\.\/|\.\/)+lib\/(.*?)['"]/g, "'@shared/lib/$1'");

    if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated: ${filepath}`);
    }
}

walk(path.join(process.cwd(), 'src'), updateImports);
console.log('Update Complete.');
