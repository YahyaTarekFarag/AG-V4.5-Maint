import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';

export type UserProfile = {
    id: string;
    role: string;
    brand_id?: string | null;
    sector_id?: string | null;
    area_id?: string | null;
    branch_id?: string | null;
};

/**
 * Applies strict RBAC filters to any Supabase query based on user hierarchy.
 * This ensures that a Sector Manager only sees data within their sector, etc.
 */
export function applyRBACFilter(
    query: any,
    tableName: string,
    profile: UserProfile | null
) {
    if (!profile) return query;

    const GLOBAL_ROLES = ['admin', 'maintenance_manager', 'maintenance_supervisor'];
    if (GLOBAL_ROLES.includes(profile.role)) return query;

    // ─── Dynamic Registry-Based RBAC ───
    const sovConfig = SOVEREIGN_REGISTRY[tableName];
    if (!sovConfig) return query; // If no config, we can't apply RBAC securely

    const rbacLevel = sovConfig.rbacLevel || 'global';
    if (rbacLevel === 'global') return query;

    // Determine the user's scope based on their profile
    const userScope = profile.branch_id ? { level: 'branch', id: profile.branch_id }
        : profile.area_id ? { level: 'area', id: profile.area_id }
            : profile.sector_id ? { level: 'sector', id: profile.sector_id }
                : profile.brand_id ? { level: 'brand', id: profile.brand_id }
                    : null;

    if (!userScope) return query;

    // Get the mapping of profile levels to database columns
    // This allows different tables to have different hierarchy paths
    const branchCol = sovConfig.directBranchColumn || 'branch_id';

    // Special case for branches table itself
    if (tableName === 'branches') {
        if (userScope.level === 'branch') return query.eq('id', userScope.id);
        if (userScope.level === 'area') return query.eq('area_id', userScope.id);
        if (userScope.level === 'sector') return query.eq('areas.sector_id', userScope.id);
        if (userScope.level === 'brand') return query.eq('areas.sectors.brand_id', userScope.id);
    }

    // Apply the filter based on the rbacLevel requirement and user's scope
    // Note: This relies on getRBACSelect providing the necessary inner joins
    if (userScope.level === 'branch') query = query.eq(branchCol, userScope.id);
    else if (userScope.level === 'area') query = query.eq(tableName === 'profiles' ? 'area_id' : 'branches.area_id', userScope.id);
    else if (userScope.level === 'sector') query = query.eq(tableName === 'profiles' ? 'sector_id' : 'branches.areas.sector_id', userScope.id);
    else if (userScope.level === 'brand') query = query.eq(tableName === 'profiles' ? 'brand_id' : 'branches.areas.sectors.brand_id', userScope.id);

    return query;
}

/**
 * Returns a secure select string for profiles to hide sensitive data from unauthorized users.
 */
export function getSecureProfileSelect(role: string) {
    const SENSITIVE_ROLES = ['admin', 'maintenance_manager'];
    if (SENSITIVE_ROLES.includes(role)) return '*';

    // Explicitly list allowed columns - excluding rates and IDs
    return 'id, employee_code, full_name, role, branch_id, area_id, sector_id, brand_id, created_at';
}

/**
 * Returns a select string that includes necessary joins for RBAC if needed
 */
export function getRBACSelect(tableName: string) {
    switch (tableName) {
        case 'tickets':
            return '*, branches!inner(name, area_id, areas!inner(sector_id, sectors!inner(brand_id))), maintenance_categories!tickets_category_id_fkey(name)';
        case 'maintenance_assets':
            return '*, branches!inner(name, area_id, areas!inner(sector_id, sectors!inner(brand_id))), maintenance_categories(name)';
        case 'profiles':
            return '*, branches!inner(area_id, areas!inner(sector_id, sectors!inner(brand_id)))';
        case 'branches':
            return '*, areas!inner(sector_id, sectors!inner(brand_id))';
        case 'technician_attendance':
        case 'technician_missions':
        case 'payroll_logs':
            return '*, profiles!inner(branch_id, area_id, sector_id, brand_id)';
        case 'inventory_transactions':
            return '*, profiles:technician_id!inner(branch_id, area_id, sector_id, brand_id)';
        default:
            return '*';
    }
}
