import { SovereignSchema } from '@engine/lib/sovereign';

const OPS_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager'];

export const CORE_CONFIG: Record<string, SovereignSchema> = {
    branches: {
        tableName: 'branches',
        label: 'قائمة الفروع',
        description: 'إدارة بيانات المواقع الجغرافية للفروع ونطاق التغطية التشغيلية.',
        icon: 'Store',
        color: 'emerald',
        selectString: '*, areas:area_id!inner(name, sector_id, sectors:sector_id!inner(name, brand_id, brands:brand_id(name)))',
        rbacLevel: 'area',
        directBranchColumn: 'id',
        path: '/manage/branches',
        roles: OPS_ROLES,
        relationships: {
            area_id: 'areas'
        }
    },
    sectors: {
        tableName: 'sectors',
        label: 'قطاعات التشغيل',
        description: 'الهيكل التنظيمي الرئيسي لإدارة العلامات التجارية والأنشطة الكبرى.',
        icon: 'Layers',
        color: 'rose',
        selectString: '*, brands:brand_id!inner(name)',
        rbacLevel: 'brand',
        directBranchColumn: 'brand_id',
        path: '/manage/sectors',
        roles: ['admin', 'brand_ops_manager'],
        relationships: {
            brand_id: 'brands'
        }
    },
    areas: {
        tableName: 'areas',
        label: 'المناطق التشغيلية',
        description: 'إدارة النطاقات الجغرافية والمناطق التي تشرف على الفروع وتتبع القطاعات.',
        icon: 'Map',
        color: 'amber',
        selectString: '*, sectors:sector_id!inner(name, brands:brand_id!inner(name))',
        rbacLevel: 'sector',
        directBranchColumn: 'sector_id',
        path: '/manage/areas',
        roles: ['admin', 'brand_ops_manager', 'sector_manager'],
        relationships: {
            sector_id: 'sectors'
        }
    },
    brands: {
        tableName: 'brands',
        label: 'العلامات التجارية',
        description: 'إدارة الكيانات الكبرى والعلامات التجارية التابعة للمؤسسة.',
        icon: 'Award',
        color: 'indigo',
        selectString: '*',
        rbacLevel: 'global',
        path: '/manage/brands',
        roles: ['admin', 'brand_ops_manager'],
        supportsSoftDelete: true
    }
};
