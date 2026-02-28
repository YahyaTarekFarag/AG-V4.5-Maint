import fs from 'fs';
const content = `# مهام تحسين وإعادة هيكلة المشروع

- [x] **المرحلة الأولى: توحيد بنية قاعدة البيانات (DB Unification)**
  - [x] إنشاء بنية الملفات الجديدة \`database/migrations/\`
  - [x] بناء \`V01__init_core_schema.sql\` (الأساسيات)
  - [x] بناء \`V02__assets_and_inventory.sql\` (الأصول والمخزون)
  - [x] بناء \`V03__tickets_maintenance.sql\` (البلاغات)
  - [x] بناء \`V04__hr_and_attendance.sql\` (الموارد البشرية)
  - [x] بناء \`V05__core_functions_triggers.sql\` (الإجراءات)
  - [x] بناء \`V06__reporting_views.sql\` (واجهات العرض للتقارير)
  - [x] تطوير سكربت الإطلاق \`database/db:init.mjs\`
- [x] **المرحلة الثانية: تحسين الأداء (Performance & Views)**
  - [x] إضافة فهارس البحث \`Indexes\` لجدول البلاغات
  - [x] إضافة فهارس البحث \`Indexes\` لجداول الهيكل التنظيمي
  - [x] تحديث \`ReportsPage.tsx\` للاستفادة من قواعد البيانات المجمعة
- [x] **المرحلة الثالثة: إصلاح العيوب البرمجية (Bug Fixes)**
  - [x] إصلاح استعلام الـ \`Missing Column\` في \`useSovereign.ts\`
  - [x] تحصين دالة الـ \`Export\` من تجاوز حدود الذاكرة وتسريب البيانات
  - [x] توحيد أوقات النظام (\`UTC\`) في \`ManagerTicketsPage\`
  - [x] سد ثغرة الـ \`Memory leak\` بالداشبورد
- [x] **المرحلة الرابعة: إعادة هيكلة مجلدات الواجهة (Modularization)**
  - [x] بناء المجلدات الفرعية في \`src/modules\`
  - [x] نقل ملفات الـ \`Pages\` لمجلداتها الدومينية المناسبة
  - [x] فصل مكوّنات الصيانة لتصبح ضمن \`src/modules/maintenance/components\`
  - [x] نقل خطافات البيانات (Hooks) لمجلدات المديول الخاص بها
  - [x] تحديث وحل مشاكل مسارات الاستيراد (Import paths)

- [x] **المرحلة الخامسة: إصلاحات التكامل المتقدمة (Missing Features & Zero Stats)**
  - [x] بناء دالة \`get_table_metrics\` المفقودة والمسؤولة عن عرض واجهات المخزون.
  - [x] إصلاح ربط (JOIN) الجداول في \`get_dashboard_stats\` لتجنب ظهور "0".
  - [x] تنفيذ أوامر SQL الجديدة على قاعدة البيانات وفحص النتيجة.

- [x] **المرحلة السادسة: معالجة أخطاء ما بعد التحديث (Post-Migration Bugs)**
  - [x] فحص وإصلاح تصاريح \`RLS\` (Row Level Security) الخاصة بجدول \`technician_attendance\` والتي تمنع تسجيل الحضور.
  - [x] فحص وإصلاح مشكلة القوائم المنسدلة (Dropdowns) المعطلة في شاشة تسجيل بلاغ عطل جديد.

- [x] **المرحلة السابعة: فحص تعارضات العَقْد بين الكود وقاعدة البيانات (Schema Contract Mismatch)**
  - [x] تحليل كامل التباينات بين واجهات \`React\` وهيكل \`SQL\` وتحديد المسببات الجذرية للأعطال.
  - [x] إعداد وتقديم تقرير مفصل \`schema_contract_report.md\` بقوائم التعارض ومستوى الخطورة وخطوات الحل الموحدة دون تعديل الكود الأمامي.

- [x] **المرحلة الثامنة: المراجعة الشاملة للواجهات وإصلاح عيوب الاستقرار (Comprehensive QA & UI Stability)**
  - [x] إصلاح معالجة التواريخ والـ \`NaN\` في \`SovereignTable.tsx\` الخاصة بالجدول والتصدير/الاستيراد.
  - [x] حماية دالة \`handleSubmit\` من التحويل العشوائي للنصوص بإستخدام \`JSON.parse\` داخل \`SovereignActionModal.tsx\`.
  - [x] تحديث منطق النطاق الزمني (Date Ranges) في \`SovereignFilterPanel.tsx\` لكي يتوافق مع \`useSovereign.ts\`.
  - [x] بناء معالجة للتواريخ غير الصالحة بالـ \`TicketFlow.tsx\` وإضافة خاصية \`htmlFor\` للعناوين.
  - [x] استبدال معالجة الأوقات \`getLocalISOString\` بالمنطقة الزمنية العالمية للحفاظ على تماسك البيانات ضمن \`ManagerTicketsPage.tsx\`.

- [x] **المرحلة التاسعة: إعادة هيكلة النظام للأعماق (Deep System Audit & Structural Overhaul)**
  - [x] بناء سكربت \`V13__schema_harmonization.sql\` لتوحيد أعمدة التدقيق \`is_deleted\` في كل الجداول المشتركة.
  - [x] الرصد العشوائي (Missing Column Error) من قلّب \`useSovereign.ts\` وتوحيد استعلامات الجلب.
  - [x] حماية صفحة التقارير \`ReportsPage.tsx\` من الانهيار (Buffer Overflow) بربط التصدير بواجهة مسايرة للصفحات Pagination.
  - [x] تنظيف وإصلاح أكثر من 40 تحذير \`Linting\` يخص مصفوفات التبعية \`useEffect Dependency Arrays\` في مكوّنات الداشبورد والصفحات المتشعبة.

- [x] **المرحلة العاشرة (Deep UI QA):** فحص كامل للواجهات وإصلاح ثغرات الربط.
- [x] **المرحلة الحادية عشرة (Architecture Polish):** توحيد الهيكلية، حل تحذيرات React Fast Refresh، تنظيف كلي لـ Lint.
- [x] **المرحلة الثانية عشرة (Production Readiness):** تدقيق الجاهزية النهائية، فحص الـ Build، وتأكيد إعدادات الـ PWA.
`;
fs.writeFileSync('C:\\Users\\y_tar\\.gemini\\antigravity\\brain\\61ff91f9-f6c2-4700-a42d-877e75ea1381\\task.md', content);
console.log('Task list updated successfully');
