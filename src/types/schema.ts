export interface ColumnConfig {
    key: string;
    label: string;
    type: 'text' | 'number' | 'status' | 'date' | 'badge';
    sortable?: boolean;
}

export interface ListConfig {
    title: string;
    columns: ColumnConfig[];
    searchable?: boolean;
    searchPlaceholder?: string;
    defaultSort?: { column: string; ascending: boolean };
}

export interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'select' | 'textarea' | 'date' | 'hidden' | 'image';
    required?: boolean;
    placeholder?: string;
    dataSource?: string; // e.g., 'branches' for a select field to fetch from branches table
    dataLabel?: string;  // e.g., 'name' column in the reference table to show
    dataValue?: string;  // e.g., 'id' column to save
    options?: { label: string, value: string }[]; // For fixed dropdowns like Roles
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
}
