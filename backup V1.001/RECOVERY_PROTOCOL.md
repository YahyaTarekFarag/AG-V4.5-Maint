# 🛡️ FSC-MAINT-APP Recovery Protocol V1.001

## Purpose
This backup is designed for high-fidelity restoration of both the application code and the Supabase database state. Any agentic AI can use this folder to reconstruct the entire environment.

## 📦 Contents of this Backup
- `database/full_backup.json`: The complete dataset from all 11 core tables in JSON format.
- `database/restore_data.sql`: A generated SQL script to re-insert all data into a fresh schema.
- `database/*.sql`: Every migration, schema correction, and RPC script used to build the current state.
- `package.json`, `vite.config.ts`, `index.html`: Core configuration for the frontend React/Vite/Tailwind build.
- `.env`: Environment variable requirements (Template).

## 🛠️ Restoration Steps for an AI Agent

### 1. Database Reconstruction
1. Initialize a new Supabase project.
2. Order of execution for SQL files in `database/`:
   - Start with `migration_v1_restructure.sql` (if it contains base tables).
   - Apply all `fix_*.sql` and `add_*.sql` patches in chronological order.
   - Run `ui_schemas_update.sql` and `register_schemas.sql` to restore DynamicForm functionality.
   - Finally, execute `restore_data.sql` to populate the tables.

### 2. Frontend Reconstruction
1. Install dependencies: `npm install`.
2. Setup environment variables based on the `.env` file in this folder.
3. Start the development server: `npm run dev`.

## 📍 System State Summary (At V1.001)
- **Framework**: Vite + React + Tailwind CSS
- **PWA**: Fully enabled with mobile icon, manifest, and offline support.
- **Geofencing**: Dynamically configurable via Admin Settings.
- **RBAC**: Multi-role system (Admin, Manager, Technician, etc.) fully implemented in Sidebar and Dashboard.
- **Mobile Hardware**: Camera/GPS optimization active for Technicians.

---
*Backup generated on: 2026-02-23*
*Status: Stable / Production Ready*
