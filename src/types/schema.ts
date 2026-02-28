export interface ColumnConfig {
    key?: string;
    field?: string;
    label: string;
    type: 'text' | 'number' | 'status' | 'date' | 'datetime' | 'badge' | 'checkbox' | 'time' | 'boolean';
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
    type: 'text' | 'number' | 'email' | 'select' | 'status' | 'textarea' | 'date' | 'datetime' | 'hidden' | 'image' | 'checkbox' | 'color';
    required?: boolean;
    placeholder?: string;
    dataSource?: string;
    dataLabel?: string;
    dataValue?: string;
    options?: { label: string, value: string }[];
    scanable?: boolean;
}

export interface FormConfig {
    title?: string;
    fields: FieldConfig[];
}

export interface UISchema {
    id?: string;
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
    formatting?: {
        statusColors?: Record<string, string>;
        statusLabels?: Record<string, string>;
        lowStockAlert?: string;
    };
    directBranchColumn?: string;
}
