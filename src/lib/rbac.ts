

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

    const GLOBAL_ROLES = ['admin', 'maint_manager', 'maint_supervisor'];
    if (GLOBAL_ROLES.includes(profile.role)) return query;

    // Determine the most specific filter available
    const scope = profile.branch_id ? { level: 'branch', id: profile.branch_id }
        : profile.area_id ? { level: 'area', id: profile.area_id }
            : profile.sector_id ? { level: 'sector', id: profile.sector_id }
                : profile.brand_id ? { level: 'brand', id: profile.brand_id }
                    : null;

    if (!scope) return query;

    // tables that have a direct branch_id
    const DIRECT_BRANCH_TABLES = ['tickets', 'maintenance_assets', 'technician_attendance', 'technician_missions', 'payroll_logs', 'inventory_transactions', 'profiles'];

    if (tableName === 'branches') {
        if (scope.level === 'branch') return query.eq('id', scope.id);
        if (scope.level === 'area') return query.eq('area_id', scope.id);
        // For higher levels, we need a join or a subquery. Supabase allows filter on joins if joined.
        // But for counting, it's simpler if we use !inner joins in the select.
    }

    if (DIRECT_BRANCH_TABLES.includes(tableName)) {
        if (scope.level === 'branch') {
            if (['technician_attendance', 'technician_missions', 'payroll_logs', 'inventory_transactions'].includes(tableName)) {
                // [QUANTUM FIX] Use relationship path for branch filtering when direct col is missing
                const path = tableName === 'inventory_transactions' ? 'profiles.branch_id' : 'profiles.branch_id';
                query = query.eq(path, scope.id);
            } else {
                query = query.eq('branch_id', scope.id);
            }
        } else if (scope.level === 'area') {
            if (['tickets', 'maintenance_assets', 'technician_attendance', 'technician_missions', 'payroll_logs', 'inventory_transactions'].includes(tableName)) {
                // [SINGULARITY FIX] Use relationship path for area filtering
                const path = tableName === 'tickets' || tableName === 'maintenance_assets' ? 'branches.area_id' : 'profiles.area_id';
                query = query.eq(path, scope.id);
            } else {
                query = query.eq('area_id', scope.id);
            }
        } else if (scope.level === 'sector') {
            const path = tableName === 'tickets' || tableName === 'maintenance_assets' ? 'branches.areas.sector_id' : 'profiles.sector_id';
            query = (['tickets', 'maintenance_assets', 'technician_attendance', 'technician_missions', 'payroll_logs', 'inventory_transactions'].includes(tableName))
                ? query.eq(path, scope.id)
                : query.eq('sector_id', scope.id);
        } else if (scope.level === 'brand') {
            const path = tableName === 'tickets' || tableName === 'maintenance_assets' ? 'branches.areas.sectors.brand_id' : 'profiles.brand_id';
            query = (['tickets', 'maintenance_assets', 'technician_attendance', 'technician_missions', 'payroll_logs', 'inventory_transactions'].includes(tableName))
                ? query.eq(path, scope.id)
                : query.eq('brand_id', scope.id);
        }
    }

    return query;
}

/**
 * Returns a secure select string for profiles to hide sensitive data from unauthorized users.
 */
export function getSecureProfileSelect(role: string) {
    const SENSITIVE_ROLES = ['admin', 'maint_manager'];
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
        case 'maintenance_assets':
            return '*, branches!inner(area_id, areas!inner(sector_id, sectors!inner(brand_id)))';
        case 'profiles':
            return '*';
        case 'branches':
            return '*, areas!inner(sector_id, sectors!inner(brand_id))';
        case 'technician_attendance':
        case 'technician_missions':
        case 'payroll_logs':
        case 'inventory_transactions':
            return '*, profiles!inner(branch_id, area_id, sector_id, brand_id)';
        default:
            return '*';
    }
}
