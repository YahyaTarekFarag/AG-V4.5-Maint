/**
 * Sovereign Engine V12 - Modular Schema Registry
 * Features decentralized config approach.
 */

export interface SovereignSchema {
    tableName?: string;
    label: string;
    description?: string;
    icon?: string;
    color?: string;
    selectString?: string;
    rbacLevel?: 'branch' | 'area' | 'sector' | 'brand' | 'global';
    directBranchColumn?: string;
    path: string;
    roles: string[];
    isCustomPage?: boolean;
    readonly?: boolean;
    supportsSoftDelete?: boolean;
    relationships?: Record<string, string>;
    actions?: {
        key: string;
        label: string;
        icon: string;
        color: string;
        condition?: (row: any) => boolean;
        isAssignMode?: boolean;
        onClick?: (row: any) => void;
    }[];
    formatting?: {
        statusColors?: Record<string, string>;
        statusLabels?: Record<string, string>;
        lowStockAlert?: string;
    };
    filterableColumns?: {
        key: string;
        label: string;
        type: 'select' | 'date' | 'text' | 'status';
        dataSource?: string;
    }[];
    metrics?: {
        label: string;
        key: string;
        type: 'count' | 'sum' | 'avg';
        filter?: Record<string, any>;
        color?: 'amber' | 'blue' | 'teal' | 'rose' | 'indigo' | 'zinc' | 'purple' | 'emerald';
        icon?: string;
    }[];
}

import { MAINT_CONFIG } from '@/modules/maintenance/config';
import { INVENTORY_CONFIG } from '@/modules/inventory/config';
import { HR_CONFIG } from '@/modules/hr/config';
import { CORE_CONFIG } from '@/modules/core/config';
import { SYSTEM_CONFIG } from './system_config';
import { APP_PAGES_CONFIG } from './app_pages';

export const SOVEREIGN_REGISTRY: Record<string, SovereignSchema> = {
    ...APP_PAGES_CONFIG,
    ...MAINT_CONFIG,
    ...INVENTORY_CONFIG,
    ...HR_CONFIG,
    ...CORE_CONFIG,
    ...SYSTEM_CONFIG,
};
