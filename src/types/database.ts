export interface BaseEntity {
    id: string;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
}

export interface Profile extends BaseEntity {
    username: string;
    full_name?: string;
    role: string; // e.g., 'admin', 'manager', 'technician'
    phone?: string;
    avatar_url?: string;
    branch_id?: string;
    email?: string;
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
    metrics?: any;
}

export interface Ticket extends BaseEntity {
    branch_id: string;
    reported_by?: string;
    assigned_to?: string; // profile_id of technician
    category_id?: string;
    asset_id?: string;

    title?: string;
    description: string;
    status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
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
    parts_used?: any[]; // Array of parts used

    rating_score?: number;
    rating_comment?: string;
    closed_at?: string;
    manager_id?: string;
}

export interface Shift extends BaseEntity {
    profile_id: string;
    clock_in: string; // timestamp
    clock_out?: string; // timestamp
    shift_date: string; // date
    notes?: string;
    location_in_lat?: number;
    location_in_lng?: number;
    location_out_lat?: number;
    location_out_lng?: number;
    total_hours?: number;
}

export interface MaintenanceAsset extends BaseEntity {
    branch_id: string;
    name: string;
    serial_number?: string;
    model_number?: string;
    manufacturer?: string;
    status: 'operational' | 'maintenance' | 'offline';
    last_maintenance_at?: string;
    next_maintenance_at?: string;
}

export interface InventoryItem extends BaseEntity {
    branch_id?: string;
    name: string;
    sku: string;
    category_id?: string;
    quantity: number;
    min_stock_level: number;
    price: number;
    currency: string;
    location?: string;
}
