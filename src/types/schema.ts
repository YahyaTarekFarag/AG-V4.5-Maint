export interface ColumnConfig {
    key: string;
    label: string;
    type: 'text' | 'number' | 'status' | 'date' | 'datetime' | 'badge' | 'checkbox';
    sortable?: boolean;
}

export interface ListConfig {
    title: string;
    subtitle?: string;
    columns: ColumnConfig[];
    searchable?: boolean;
    searchPlaceholder?: string;
    defaultSort?: { column: string; ascending: boolean };
}

export interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'select' | 'textarea' | 'date' | 'datetime' | 'hidden' | 'image' | 'checkbox' | 'color';
    required?: boolean;
    placeholder?: string;
    dataSource?: string; // e.g., 'branches' for a select field to fetch from branches table
    dataLabel?: string;  // e.g., 'name' column in the reference table to show
    dataValue?: string;  // e.g., 'id' column to save
    options?: { label: string, value: string }[]; // For fixed dropdowns like Roles
    scanable?: boolean; // If true, show a QR scanner button next to the field
}

export interface FormConfig {
    title: string;
    fields: FieldConfig[];
}

export interface UISchema {
    id: string;
    table_name: string;
    list_config: ListConfig;
    form_config: FormConfig;
    page_config?: {
        kpi_cards: any[];
    };
    nav_config?: {
        is_visible: boolean;
        icon: string;
        roles: string[];
        color: string;
    };
    directBranchColumn?: string;
}
