import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export interface Profile {
    id: string;
    employee_code: string;
    full_name: string;
    role: 'admin' | 'brand_ops_manager' | 'sector_manager' | 'area_manager' | 'manager' | 'maintenance_manager' | 'maintenance_supervisor' | 'technician';
    branch_id?: string | null;
    brand_id?: string | null;
    sector_id?: string | null;
    area_id?: string | null;
    base_daily_rate?: number;
    per_km_allowance?: number;
    star_bonus_rate?: number;
}

export interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    isLoading: boolean;
    signIn: (employeeCode: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
