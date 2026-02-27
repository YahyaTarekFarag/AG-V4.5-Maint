/**
 * Sovereign Dictionary
 * Maps database column names to user-friendly Arabic labels.
 * This is used for auto-translation in the Schema Builder.
 */

export const SOVEREIGN_DICTIONARY: Record<string, string> = {
    // Common Columns
    id: "المعرّف الرقمي",
    created_at: "تاريخ الإنشاء",
    updated_at: "تاريخ التحديث",
    is_deleted: "محذوف؟",
    status: "الحالة التشغيلية",
    priority: "مستوى الأهمية",
    name: "الاسم",
    full_name: "الاسم الكامل",
    title: "العنوان",
    description: "الوصف التفصيلي",
    label: "التسمية الوظيفية",
    notes: "ملاحظات إضافية",

    // HR & Profiles
    employee_code: "كود الموظف",
    role: "الدور الوظيفي",
    email: "البريد الإلكتروني",
    phone: "رقم التواصل",
    password: "كلمة المرور",
    salary: "الراتب الأساسي",
    hiring_date: "تاريخ التعيين",

    // Relationships
    branch_id: "الفرع",
    area_id: "المنطقة",
    sector_id: "القطاع",
    brand_id: "العلامة التجارية",
    manager_id: "المدير المباشر",
    assigned_to: "الفني المكلّف",
    profile_id: "الملف الشخصي",
    user_id: "المستخدم المرتبط",
    category_id: "التصنيف",

    // Technical / Maintenance
    asset_id: "الأصل/المعدة",
    serial_number: "الرقم التسلسلي",
    model: "الموديل",
    brand: "الماركة",
    failure_type: "نوع العطل",
    repair_cost: "تكلفة الإصلاح",
    warranty_expiry: "نهاية الضمان",
    latitude: "خط العرض (GPS)",
    longitude: "خط الطول (GPS)",
    reported_lat: "موقع البلاغ (Lat)",
    reported_lng: "موقع البلاغ (Lng)",

    // Inventory
    quantity: "الكمية المتاحة",
    unit_price: "سعر الوحدة",
    min_stock: "الحد الأدنى للمخزون",
    supplier_id: "المورد",
    barcode: "باركود الصنف",
    location: "موقع التخزين",

    // Finance
    amount: "المبلغ",
    currency: "العملة",
    tax_amount: "قيمة الضريبة",
    total_amount: "الإجمالي النهائي",
};

/**
 * Suggests an Arabic label for a given database column name.
 */
export function suggestLabel(columnName: string): string {
    const key = columnName.toLowerCase().trim();
    if (SOVEREIGN_DICTIONARY[key]) return SOVEREIGN_DICTIONARY[key];

    // Simple heuristic for snake_case
    return key
        .split('_')
        .map(word => {
            // If the word exists in dictionary separately
            if (SOVEREIGN_DICTIONARY[word]) return SOVEREIGN_DICTIONARY[word];
            return word;
        })
        .join(' ');
}
