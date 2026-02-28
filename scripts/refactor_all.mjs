import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');
const MODULES = path.join(SRC, 'modules');

const fileMoves = [
    { from: 'pages/Login.tsx', to: 'modules/auth/pages/Login.tsx' },
    { from: 'pages/Dashboard.tsx', to: 'modules/dashboard/pages/Dashboard.tsx' },
    { from: 'pages/AttendanceDashboardPage.tsx', to: 'modules/hr/pages/AttendanceDashboardPage.tsx' },
    { from: 'pages/TechnicianSalaryPage.tsx', to: 'modules/hr/pages/TechnicianSalaryPage.tsx' },
    { from: 'pages/MasterDataPage.tsx', to: 'modules/inventory/pages/MasterDataPage.tsx' },
    { from: 'pages/ReportsPage.tsx', to: 'modules/reporting/pages/ReportsPage.tsx' },
    { from: 'pages/AdminSettingsPage.tsx', to: 'modules/settings/pages/AdminSettingsPage.tsx' },
    { from: 'pages/SchemaBuilderPage.tsx', to: 'modules/settings/pages/SchemaBuilderPage.tsx' },
    { from: 'pages/MapPage.tsx', to: 'modules/map/pages/MapPage.tsx' },
];

fileMoves.forEach(m => {
    const destDir = path.dirname(path.join(SRC, m.to));
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
});

fileMoves.forEach(m => {
    const srcPath = path.join(SRC, m.from);
    const destPath = path.join(SRC, m.to);
    if (fs.existsSync(srcPath)) {
        fs.renameSync(srcPath, destPath);
        console.log(`Moved ${m.from} to ${m.to}`);
    }
});

function fixImports(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace all relative ../ or ../../ with @/ safely
    // Be careful with node_modules or standard libraries, typical relative paths start with ./ or ../
    content = content.replace(/from\s+['"](?:\.\.\/)+([^'"]+)['"]/g, "from '@/$1'");
    content = content.replace(/import\s+['"](?:\.\.\/)+([^'"]+)['"]/g, "import '@/$1'");

    // Replace ./ with @/ if referencing root level items inside pages
    // example: import DashboardLayout from '../components/layout/DashboardLayout'; becomes ... from '@/components/layout...'

    // Sometimes components import sibling components via './something'. 
    // Since we only moved pages, most intra-page links don't exist, but we still fix direct imports

    fs.writeFileSync(filePath, content);
}

fileMoves.forEach(m => fixImports(path.join(SRC, m.to)));

// Fix App.tsx imports
const appTsxPath = path.join(SRC, 'App.tsx');
let appTsx = fs.readFileSync(appTsxPath, 'utf8');

const pathMappings = {
    './pages/Login': '@/modules/auth/pages/Login',
    './pages/Dashboard': '@/modules/dashboard/pages/Dashboard',
    './pages/AttendanceDashboardPage': '@/modules/hr/pages/AttendanceDashboardPage',
    './pages/TechnicianSalaryPage': '@/modules/hr/pages/TechnicianSalaryPage',
    './pages/MasterDataPage': '@/modules/inventory/pages/MasterDataPage',
    './pages/ReportsPage': '@/modules/reporting/pages/ReportsPage',
    './pages/AdminSettingsPage': '@/modules/settings/pages/AdminSettingsPage',
    './pages/SchemaBuilderPage': '@/modules/settings/pages/SchemaBuilderPage',
    './pages/MapPage': '@/modules/map/pages/MapPage',
};

for (const [key, val] of Object.entries(pathMappings)) {
    appTsx = appTsx.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), val);
}

fs.writeFileSync(appTsxPath, appTsx);

console.log('Refactoring remaining pages complete.');
