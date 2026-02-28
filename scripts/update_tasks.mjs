import fs from 'fs';
const file = 'C:\\Users\\y_tar\\.gemini\\antigravity\\brain\\61ff91f9-f6c2-4700-a42d-877e75ea1381\\task.md';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(/- \[ \] فحص جميع النوافذ المنبثقة/g, '- [x] فحص جميع النوافذ المنبثقة');
c = c.replace(/- \[ \] مراجعة استجابة القوائم المنسدلة/g, '- [x] مراجعة استجابة القوائم المنسدلة');
c = c.replace(/- \[ \] اختبار أداء الخريطة التفاعلية/g, '- [x] اختبار أداء الخريطة التفاعلية');
fs.writeFileSync(file, c);
console.log('Task list updated successfully');
