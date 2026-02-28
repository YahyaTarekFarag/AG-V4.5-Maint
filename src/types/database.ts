export interface BaseEntity {
    id: string;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
}

export interface Profile extends BaseEntity {
    employee_code: string;
    full_name: string;
    role: 'admin' | 'maint_manager' | 'maint_supervisor' | 'technician' | 'manager';
    phone?: string;
    avatar_url?: string;
    branch_id?: string;
    brand_id?: string;
    sector_id?: string;
    area_id?: string;
    preferences?: any;
    last_login?: string;
}

export interface Branch extends BaseEntity {
    name: string;
    area_id?: string;
    address?: string;
    manager_id?: string;
    latitude?: number;
    longitude?: number;
    contact_info?: any;
}

export interface Ticket extends BaseEntity {
    branch_id: string;
    reported_by?: string; // profile_id (reporter)
    assigned_to?: string; // profile_id of technician
    category_id?: string;
    asset_id?: string;
    asset_name?: string;

    title: string;
    description: string;
    status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'critical';

    is_emergency: boolean;
    reported_lat?: number;
    reported_lng?: number;

    assigned_at?: string;
    started_at?: string;
    started_lat?: number;
    started_lng?: number;

    resolved_at?: string;
    resolved_lat?: number;
    resolved_lng?: number;
    resolved_image_url?: string;

    fault_type_id?: string;
    downtime_start?: string;

    parts_cost: number;
    labor_cost: number;
    total_cost: number;
    parts_used?: { part_id: string, qty: number }[];

    rating_score?: number;
    rating_comment?: string;
    closed_at?: string;
    manager_id?: string; // Closer
}

export interface TechnicianAttendance extends BaseEntity {
    profile_id: string;
    clock_in: string;
    clock_out?: string;
    clock_in_lat?: number;
    clock_in_lng?: number;
    clock_out_lat?: number;
    clock_out_lng?: number;
    notes?: string;
}

export interface MaintenanceAsset extends BaseEntity {
    branch_id: string;
    category_id: string;
    name: string;
    serial_number?: string;
    model_number?: string;
    manufacturer?: string;
    status: 'operational' | 'faulty' | 'maintenance' | 'offline';
    last_maintenance_at?: string;
    next_maintenance_at?: string;
}

export interface InventoryItem extends BaseEntity {
    branch_id?: string;
    name: string;
    part_number?: string;
    unit?: string;
    category_id?: string;
    quantity: number;
    min_quantity?: number; // حد الطلب الأدنى (V34)
    reserved_quantity?: number; // الكمية المحجوزة (V37)
    unit_cost: number;
    location?: string;
}
