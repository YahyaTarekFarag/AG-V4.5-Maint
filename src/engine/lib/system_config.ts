import { SovereignSchema } from '@engine/lib/sovereign';

export const SYSTEM_CONFIG: Record<string, SovereignSchema> = {
    ui_schemas: {
        tableName: 'ui_schemas',
        label: 'إعدادات محرك الواجهات السيادية (للمطورين)',
        description: 'إدارة مخططات العرض، الحقول، وصلاحيات الجداول الديناميكية.',
        icon: 'Settings',
        color: 'zinc',
        selectString: '*',
        rbacLevel: 'global',
        path: '/manage/ui_schemas',
        roles: ['admin'],
        readonly: true,
        supportsSoftDelete: false
    },
    system_settings: {
        tableName: 'system_settings',
        label: 'إعدادات النظام السياسية (للمطورين)',
        description: 'تكوينات النظام الأساسية، قيود الفروع، والثوابت التشغيلية.',
        icon: 'Shield',
        color: 'zinc',
        selectString: '*',
        rbacLevel: 'global',
        path: '/manage/system_settings',
        roles: ['admin'],
        readonly: true,
        supportsSoftDelete: false
    },
    shifts: {
        tableName: 'shifts',
        label: 'سجل المناوبات القديم (مرجع)',
        description: 'استعراض بيانات المناوبات من النظام السابق (لأغراض الأرشفة فقط).',
        icon: 'Clock',
        color: 'zinc',
        selectString: '*',
        rbacLevel: 'global',
        path: '/manage/shifts',
        roles: ['admin'],
        supportsSoftDelete: false
    }
};
