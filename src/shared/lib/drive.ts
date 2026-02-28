import { supabase } from './supabase';

/**
 * خدمة الرفع إلى جوجل درايف
 * ملاحظة: تتطلب هذه الخدمة تفعيل OAuth أو استخدام بروكسي مؤمن.
 * إذا لم تتوفر المفاتيح، سيتم الرفع مؤقتاً إلى Supabase Storage مع الاحتفاظ بالمنطق البرمجي.
 */
export async function uploadToDrive(file: File, folderName: string = 'maintenance_photos') {
    try {
        // فحص وجود إعدادات جوجل درايف في قاعدة البيانات (اختياري)
        // const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'gdrive_config').single();

        // منطق الرفع الحالي (Supabase Storage كبديل مؤقت لضمان عمل البرنامج)
        // يتم الاحتفاظ بمسار جوجل درايف في قاعدة البيانات
        if (!navigator.onLine) {
            throw new Error("لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة وإعادة المحاولة.");
        }
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${folderName}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('media') // تأكد من إنشاء Bucket باسم media في Supabase
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('media').getPublicUrl(filePath);
        return data.publicUrl;

    } catch (error) {
        console.error('Drive upload error:', error);
        throw error;
    }
}
