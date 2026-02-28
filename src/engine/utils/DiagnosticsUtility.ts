import { SOVEREIGN_REGISTRY } from '../lib/sovereign';
import { supabase } from '@shared/lib/supabase';

export interface DiagnosticIssue {
    level: 'error' | 'warning' | 'info';
    component: string;
    message: string;
    suggestion?: string;
}

/**
 * DiagnosticsUtility
 * أداة لفحص صحة النظام واكتشاف الفجوات بين قاعدة البيانات وإعدادات المحرك السيادي.
 */
export const DiagnosticsUtility = {
    /**
     * فحص شامل لكافة الجداول المسجلة في السجل السيادي
     */
    async runFullAudit(): Promise<DiagnosticIssue[]> {
        const issues: DiagnosticIssue[] = [];
        const tables = Object.keys(SOVEREIGN_REGISTRY);

        console.log('--- Starting Sovereign Diagnostics Audit ---');

        for (const tableName of tables) {
            const config = SOVEREIGN_REGISTRY[tableName];

            // 1. فحص وجود الجدول في قاعدة البيانات (عينة عشوائية)
            try {
                const { error } = await supabase.from(tableName).select('*').limit(1);
                if (error) {
                    issues.push({
                        level: 'error',
                        component: tableName,
                        message: `الجدول غير موجود أو لا يمكن الوصول إليه: ${error.message}`,
                        suggestion: 'تأكد من تنفيذ المهاجرة (Migration) الخاصة بالجدول.'
                    });
                }
            } catch (e: any) {
                issues.push({
                    level: 'error',
                    component: tableName,
                    message: `فشل الاتصال بجدول ${tableName}: ${e.message}`
                });
            }

            // 2. فحص الـ Select String وجودة الجوين (Joins)
            if (config.selectString?.includes('*') && config.selectString.length > 2) {
                // Warning if mixing * with joins loosely
                if (config.selectString.includes(':')) {
                    issues.push({
                        level: 'info',
                        component: tableName,
                        message: 'يستخدم الجدول نظام النجمة (*) مع الجوين. يفضل تحديد الأعمدة صراحة للأداء.',
                        suggestion: 'قم بتخصيص قائمة الحقول بدلاً من *'
                    });
                }
            }

            // 3. فحص الـ RBAC والـ Foreign Keys
            if (config.rbacLevel !== 'global' && !config.directBranchColumn && !config.relationships?.branch_id) {
                issues.push({
                    level: 'warning',
                    component: tableName,
                    message: `مستوى الوصول ${config.rbacLevel} يتطلب مرجعاً للفرع (branch_id).`,
                    suggestion: 'أضف directBranchColumn أو علاقة branch_id.'
                });
            }

            // 4. فحص الـ Metrics
            if (config.metrics) {
                for (const metric of config.metrics) {
                    if (metric.type === 'sum' && !metric.key) {
                        issues.push({
                            level: 'error',
                            component: `${tableName}.metrics.${metric.label}`,
                            message: 'المقياس من نوع الجمع (sum) يتطلب تحديد مفتاح (key) للعمود المطلوب جمعه.'
                        });
                    }
                }
            }

            // 5. فحص الـ Actions
            if (config.actions) {
                for (const action of config.actions) {
                    if (!action.icon) {
                        issues.push({
                            level: 'warning',
                            component: `${tableName}.actions.${action.label}`,
                            message: 'الأمر لا يحتوي على أيقونة (icon).'
                        });
                    }
                }
            }
        }

        console.log(`--- Audit Complete: Found ${issues.length} potential issues ---`);
        return issues;
    }
};
