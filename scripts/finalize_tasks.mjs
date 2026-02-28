import fs from 'fs';
const file = 'C:\\Users\\y_tar\\.gemini\\antigravity\\brain\\61ff91f9-f6c2-4700-a42d-877e75ea1381\\task.md';
let c = fs.readFileSync(file, 'utf8');
// Mark Phase 9 linting
c = c.replace(/- \[ \] تنظيف وإصلاح أكثر من 40 تحذير/g, '- [x] تنظيف وإصلاح أكثر من 40 تحذير');
// Add Phase 10 & 11 as completed sections
if (!c.includes('المرحلة العاشرة')) {
    c += '\n- [x] **المرحلة العاشرة (Deep UI QA):** فحص كامل للواجهات وإصلاح ثغرات الربط.\n';
}
if (!c.includes('المرحلة الحادية عشرة')) {
    c += '- [x] **المرحلة الحادية عشرة (Architecture Polish):** توحيد الهيكلية، حل تحذيرات React Fast Refresh، تنظيف كلي لـ Lint.\n';
}
fs.writeFileSync(file, c);
console.log('Task list finalized');
