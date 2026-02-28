import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');
const MODULES = path.join(SRC, 'modules');
const MAINT = path.join(MODULES, 'maintenance');

const dirs = [
    path.join(MAINT, 'pages'),
    path.join(MAINT, 'components')
];

dirs.forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const fileMoves = [
    { from: 'pages/ManagerTicketsPage.tsx', to: 'modules/maintenance/pages/ManagerTicketsPage.tsx' },
    { from: 'pages/TechnicianTicketsPage.tsx', to: 'modules/maintenance/pages/TechnicianTicketsPage.tsx' },
    { from: 'pages/MaintenanceDashboardPage.tsx', to: 'modules/maintenance/pages/MaintenanceDashboardPage.tsx' },
    { from: 'components/tickets/TicketFlow.tsx', to: 'modules/maintenance/components/TicketFlow.tsx' }
];

fileMoves.forEach(m => {
    const srcPath = path.join(SRC, m.from);
    const destPath = path.join(SRC, m.to);
    if (fs.existsSync(srcPath)) {
        fs.renameSync(srcPath, destPath);
        console.log(`Moved ${m.from} to ${m.to}`);
    }
});

// Update imports in the moved files
function fixImports(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace all relative ../ or ../../ with @/
    content = content.replace(/from\s+['"](?:\.\.\/)+([^'"]+)['"]/g, "from '@/$1'");
    content = content.replace(/import\s+['"](?:\.\.\/)+([^'"]+)['"]/g, "import '@/$1'");

    // Explicitly fix TicketFlow import in pages
    content = content.replace(/['"]@\/components\/tickets\/TicketFlow['"]/g, "'@/modules/maintenance/components/TicketFlow'");

    fs.writeFileSync(filePath, content);
}

fileMoves.forEach(m => fixImports(path.join(SRC, m.to)));

// Fix App.tsx imports
const appTsxPath = path.join(SRC, 'App.tsx');
let appTsx = fs.readFileSync(appTsxPath, 'utf8');
appTsx = appTsx.replace(/\.\/pages\/ManagerTicketsPage/g, '@/modules/maintenance/pages/ManagerTicketsPage');
appTsx = appTsx.replace(/\.\/pages\/TechnicianTicketsPage/g, '@/modules/maintenance/pages/TechnicianTicketsPage');
appTsx = appTsx.replace(/\.\/pages\/MaintenanceDashboardPage/g, '@/modules/maintenance/pages/MaintenanceDashboardPage');
fs.writeFileSync(appTsxPath, appTsx);

console.log('Refactoring complete.');
