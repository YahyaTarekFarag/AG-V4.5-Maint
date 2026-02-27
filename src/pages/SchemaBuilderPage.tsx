import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { UISchema, FieldConfig, ColumnConfig } from '../types/schema';
import { KPICardConfig } from '../components/sovereign/SovereignKPICard';
import SovereignKPICard from '../components/sovereign/SovereignKPICard';
import {
    Plus, Trash2, Save, ChevronDown, ChevronUp, GripVertical,
    Settings2, List, FormInput, Loader2, CheckCircle2, AlertCircle,
    ToggleLeft, ToggleRight, Database, RefreshCw, X, Table2,
    Zap, BarChart3, Wand2, Binary, Sparkles, ShieldCheck
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { suggestLabel } from '../lib/sovereign-dictionary';

const FIELD_TYPES: { value: FieldConfig['type']; label: string }[] = [
    { value: 'text', label: '📝 نص' },
    { value: 'textarea', label: '📄 نص كبير' },
    { value: 'number', label: '🔢 رقم' },
    { value: 'date', label: '📅 تاريخ' },
    { value: 'select', label: '📋 قائمة منسدلة' },
    { value: 'email', label: '📧 بريد إلكتروني' },
    { value: 'hidden', label: '🙈 مخفي' },
];

const COLUMN_TYPES: { value: ColumnConfig['type']; label: string }[] = [
    { value: 'text', label: '📝 نص' },
    { value: 'number', label: '🔢 رقم' },
    { value: 'date', label: '📅 تاريخ' },
    { value: 'status', label: '🔵 حالة' },
    { value: 'badge', label: '🏷️ شارة' },
];

// Postgres type mapped from form field type
const PG_TYPE_MAP: Record<string, string> = {
    text: 'text', textarea: 'text', email: 'text', hidden: 'text',
    select: 'text', number: 'numeric', date: 'timestamptz',
};

const emptyField = (): FieldConfig => ({ key: '', label: '', type: 'text', required: false, placeholder: '' });
const emptyColumn = (): ColumnConfig => ({ key: '', label: '', type: 'text', sortable: true });

interface DbTable { table_name: string; row_count: number; registered: boolean; }

export default function SchemaBuilderPage() {
    // ── Schema state ──────────────────────────────────────────
    const [schemas, setSchemas] = useState<UISchema[]>([]);
    const [selected, setSelected] = useState<UISchema | null>(null);
    const [formFields, setFormFields] = useState<FieldConfig[]>([]);
    const [listCols, setListCols] = useState<ColumnConfig[]>([]);
    const [tableTitle, setTableTitle] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [activeTab, setActiveTab] = useState<'form' | 'list' | 'kpi' | 'nav'>('form');
    const [kpiCards, setKpiCards] = useState<KPICardConfig[]>([]);
    const [navConfig, setNavConfig] = useState<{ is_visible: boolean; icon: string; roles: string[]; color: string }>({
        is_visible: true,
        icon: 'Layout',
        roles: ['admin'],
        color: 'blue'
    });

    // ── DB Explorer state ─────────────────────────────────────
    const [dbTables, setDbTables] = useState<DbTable[]>([]);
    const [dbLoading, setDbLoading] = useState(false);
    const [sidebarMode, setSidebarMode] = useState<'schemas' | 'explorer'>('explorer');
    const [discoveredCols, setDiscoveredCols] = useState<{ name: string; type: string }[]>([]);
    const [discovering, setDiscovering] = useState(false);

    // ── Status state ──────────────────────────────────────────
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [loading, setLoading] = useState(false);

    // ── New Schema modal ──────────────────────────────────────
    const [newSchemaModal, setNewSchemaModal] = useState(false);
    const [newTableName, setNewTableName] = useState('');
    const [newDisplayName, setNewDisplayName] = useState('');
    const [addingSchema, setAddingSchema] = useState(false);
    const [createDbTable, setCreateDbTable] = useState(true);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        await Promise.all([fetchSchemas(), fetchDbTables()]);
        setLoading(false);
    };

    const fetchSchemas = async () => {
        const { data } = await supabase.from('ui_schemas' as any).select('*').order('table_name');
        if (data) setSchemas(data as UISchema[]);
    };

    const fetchDbTables = async () => {
        setDbLoading(true);
        const { data, error } = await supabase.rpc('sovereign_list_tables');
        if (!error && data) {
            const { data: schemaData } = await supabase.from('ui_schemas' as any).select('table_name');
            const registeredNames = new Set((schemaData || []).map((s: any) => s.table_name));
            setDbTables((data as any[]).map(t => ({
                table_name: t.table_name,
                row_count: t.row_count,
                registered: registeredNames.has(t.table_name),
            })));
        }
        setDbLoading(false);
    };

    const handleSelect = (s: UISchema) => {
        setSelected(s);
        setFormFields(s.form_config?.fields || []);
        setListCols(s.list_config?.columns || []);
        setTableTitle(s.list_config?.title || '');
        setFormTitle(s.form_config?.title || '');
        setKpiCards((s as any).page_config?.kpi_cards || []);
        setNavConfig((s as any).nav_config || { is_visible: true, icon: 'Layout', roles: ['admin'], color: 'blue' });
        setSaveStatus('idle');
        fetchDiscoveredColumns(s.table_name);
    };

    const fetchDiscoveredColumns = async (tableName: string) => {
        setDiscovering(true);
        try {
            const { data, error } = await supabase.rpc('get_table_columns', { p_table_name: tableName });
            if (!error && data) {
                setDiscoveredCols((data as any[]).map(c => ({
                    name: c.column_name,
                    type: c.data_type
                })));
            }
        } catch (e) {
            console.error('Field discovery error', e);
        } finally {
            setDiscovering(false);
        }
    };

    const importFromDb = (colName: string) => {
        const alreadyInForm = formFields.some(f => f.key === colName);
        if (alreadyInForm) return;

        const label = suggestLabel(colName);
        const newField: FieldConfig = {
            key: colName,
            label: label,
            type: colName.includes('date') || colName.includes('at') ? 'date' :
                colName.includes('id') ? 'select' : 'text',
            required: false,
            placeholder: `أدخل ${label}`
        };
        setFormFields(p => [...p, newField]);

        // Also add to list view if not present
        if (!listCols.some(c => c.key === colName)) {
            setListCols(p => [...p, { key: colName, label: label, type: 'text', sortable: true }]);
        }
    };

    // ── Auto-DDL Save ─────────────────────────────────────────
    const handleSave = async () => {
        if (!selected) return;
        const invalid = formFields.some(f => !f.key.trim() || !f.label.trim())
            || listCols.some(c => !c.key.trim() || !c.label.trim());
        if (invalid) { setSaveStatus('error'); setStatusMsg('تأكد من ملء اسم ظاهر واسم برمجي لكل حقل'); return; }

        setSaving(true);
        setSaveStatus('idle');

        try {
            // 1. Auto-add missing DB columns via RPC (no SQL needed!)
            const addResults: string[] = [];
            for (const field of formFields) {
                if (!field.key.trim() || field.type === 'hidden') continue;
                const pgType = PG_TYPE_MAP[field.type] || 'text';
                const { data, error } = await supabase.rpc('sovereign_add_column', {
                    p_table: selected.table_name,
                    p_column: field.key.trim(),
                    p_type: pgType,
                });
                if (error) throw new Error(`فشل إضافة عمود ${field.key}: ${error.message}`);
                if ((data as any)?.action === 'added') addResults.push(field.key);
            }

            // 2. Save schema definition including KPI cards
            const { error: saveError } = await supabase
                .from('ui_schemas' as any)
                .update({
                    list_config: { ...selected.list_config, title: tableTitle, columns: listCols },
                    form_config: { ...selected.form_config, title: formTitle, fields: formFields },
                    page_config: { kpi_cards: kpiCards },
                    nav_config: navConfig,
                })
                .eq('id', selected.id);

            if (saveError) throw saveError;

            const msg = addResults.length
                ? `✅ تم الحفظ وإضافة ${addResults.length} عمود جديد: ${addResults.join(', ')}`
                : '✅ تم حفظ الإعدادات بنجاح';
            setSaveStatus('success');
            setStatusMsg(msg);
            fetchSchemas();
            setTimeout(() => setSaveStatus('idle'), 4000);
        } catch (e: any) {
            setSaveStatus('error');
            setStatusMsg(e.message || 'حدث خطأ غير متوقع');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete field with DB column drop ─────────────────────
    const handleDeleteField = async (i: number) => {
        const field = formFields[i];
        if (!selected || !field.key.trim()) {
            setFormFields(p => p.filter((_, j) => j !== i));
            return;
        }
        const confirm = window.confirm(`هل تريد حذف الحقل "${field.label}" وعمود "${field.key}" من قاعدة البيانات أيضاً؟\n\n⚠️ سيؤدي هذا لفقدان البيانات في هذا العمود!`);
        if (!confirm) {
            setFormFields(p => p.filter((_, j) => j !== i));
            return;
        }
        await supabase.rpc('sovereign_drop_column', {
            p_table: selected.table_name,
            p_column: field.key.trim(),
        });
        setFormFields(p => p.filter((_, j) => j !== i));
    };

    // ── Add New Schema with optional DB Table creation ────────
    const handleAddSchema = async () => {
        const key = newTableName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!key) return;
        setAddingSchema(true);
        try {
            if (createDbTable) {
                const { error: createErr } = await supabase.rpc('sovereign_create_table', { p_table: key });
                if (createErr) throw createErr;
            }
            const { error } = await supabase
                .from('ui_schemas' as any)
                .insert([{
                    table_name: key,
                    form_config: { title: newDisplayName || key, fields: [] },
                    list_config: { title: newDisplayName || key, columns: [] },
                }]);
            if (error) throw error;
            setNewSchemaModal(false);
            setNewTableName('');
            setNewDisplayName('');
            setCreateDbTable(true);
            fetchAll();
        } catch (e: any) {
            alert(`خطأ: ${e.message}`);
        } finally {
            setAddingSchema(false);
        }
    };

    // ── Register unregistered table ───────────────────────────
    const handleRegisterTable = async (tableName: string) => {
        const { error } = await supabase
            .from('ui_schemas' as any)
            .insert([{
                table_name: tableName,
                form_config: { title: tableName, fields: [] },
                list_config: { title: tableName, columns: [] },
            }]);
        if (!error) fetchAll();
    };

    // ── Field helpers ─────────────────────────────────────────
    const updateField = (i: number, k: keyof FieldConfig, v: any) =>
        setFormFields(p => { const a = [...p]; a[i] = { ...a[i], [k]: v }; return a; });
    const moveField = (i: number, dir: 'up' | 'down') =>
        setFormFields(p => {
            const a = [...p]; const t = dir === 'up' ? i - 1 : i + 1;
            if (t < 0 || t >= a.length) return a;
            [a[i], a[t]] = [a[t], a[i]]; return a;
        });
    const updateCol = (i: number, k: keyof ColumnConfig, v: any) =>
        setListCols(p => { const a = [...p]; a[i] = { ...a[i], [k]: v }; return a; });

    const inp = 'w-full bg-surface-900 border border-surface-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all placeholder:text-surface-600';

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                        <Settings2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-surface-900 dark:text-white">محرك الواجهات السيادي V2</h2>
                        <p className="text-surface-500 text-sm">إدارة كاملة لقاعدة البيانات والواجهات — بدون SQL</p>
                    </div>
                </div>
                <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 text-sm text-surface-400 hover:text-white hover:bg-surface-900 rounded-xl transition-all border border-surface-800">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    تحديث
                </button>
            </div>

            <div className="flex gap-5 items-start">
                {/* ── Sidebar ────────────────────────────────── */}
                <div className="w-60 shrink-0 flex flex-col gap-2">
                    {/* Toggle */}
                    <div className="flex bg-surface-900 p-1 rounded-xl gap-1 border border-surface-800">
                        {[
                            { id: 'explorer', label: 'DB Explorer', icon: Database },
                            { id: 'schemas', label: 'المسجّلة', icon: Settings2 },
                        ].map(({ id, label, icon: Icon }) => (
                            <button key={id} onClick={() => setSidebarMode(id as any)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${sidebarMode === id ? 'bg-surface-800 text-white shadow-lg border border-white/5' : 'text-surface-500'}`}>
                                <Icon className="w-3.5 h-3.5" />{label}
                            </button>
                        ))}
                    </div>

                    {/* Add new */}
                    <button onClick={() => setNewSchemaModal(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-primary-500/20">
                        <Plus className="w-4 h-4" /> إنشاء جدول جديد
                    </button>

                    {/* Table list */}
                    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
                        {sidebarMode === 'explorer' ? (
                            dbLoading ? (
                                <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary-400" /></div>
                            ) : (
                                <div className="max-h-[60vh] overflow-y-auto">
                                    {dbTables.map(t => (
                                        <div key={t.table_name}
                                            onClick={() => { const s = schemas.find(s => s.table_name === t.table_name); if (s) handleSelect(s); }}
                                            className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer border-b border-surface-100 dark:border-surface-800 last:border-0 transition-all hover:bg-surface-50 dark:hover:bg-surface-800 ${selected?.table_name === t.table_name ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold' : 'text-surface-700 dark:text-surface-300'}`}
                                        >
                                            <span className="text-base">{t.registered ? '🟢' : '⚪'}</span>
                                            <span className="flex-1 truncate font-mono text-xs">{t.table_name}</span>
                                            <span className="text-xs text-surface-400 shrink-0">{t.row_count}</span>
                                            {!t.registered && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleRegisterTable(t.table_name); }}
                                                    title="تسجيل في المحرك"
                                                    className="shrink-0 px-1.5 py-0.5 bg-primary-900/40 text-primary-400 border border-primary-500/30 rounded text-xs font-semibold hover:bg-primary-500 hover:text-white transition-colors">
                                                    +
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
                                {schemas.map(s => (
                                    <button key={s.id} onClick={() => handleSelect(s)}
                                        className={`w-full text-right px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${selected?.id === s.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'text-surface-400 hover:bg-surface-800'}`}
                                    >{s.table_name}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="text-xs text-surface-500 px-1 space-y-1">
                        <p>🟢 مسجّل في المحرك</p>
                        <p>🔵 موجود في DB غير مسجّل</p>
                    </div>
                </div>

                {/* ── Main Panel ──────────────────────────────── */}
                {!selected ? (
                    <div className="flex-1 bg-surface-900 rounded-2xl border border-surface-800 shadow-2xl flex items-center justify-center py-24">
                        <div className="text-center text-surface-400">
                            <Database className="w-14 h-14 mx-auto mb-3 text-surface-300" />
                            <p className="font-semibold text-lg">اختر جدولاً لبدء التعديل</p>
                            <p className="text-sm mt-1">🟢 من القائمة أو أنشئ جدولاً جديداً</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col gap-4">
                        {/* Table info bar */}
                        <div className="bg-surface-900 border border-surface-800 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-xl">
                            <Table2 className="w-5 h-5 text-primary-500" />
                            <span className="font-mono text-sm font-semibold text-white">{selected.table_name}</span>
                            <span className="text-surface-300">←</span>
                            <span className="text-sm text-surface-500">{formFields.length} حقل في النموذج · {listCols.length} عمود في الجدول</span>
                            <div className="mr-auto flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-900/10 px-3 py-1 rounded-full border border-emerald-900/30">
                                <Zap className="w-3.5 h-3.5" />
                                الحفظ يُضيف الأعمدة لـ DB آلياً
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 bg-surface-900 p-1 rounded-xl w-fit border border-surface-800">
                            {[
                                { id: 'form', label: 'حقول النموذج', icon: FormInput },
                                { id: 'list', label: 'أعمدة الجدول', icon: List },
                                { id: 'kpi', label: 'KPI Cards', icon: BarChart3 },
                                { id: 'nav', label: 'إعدادات المنصة (SaaS)', icon: Sparkles },
                            ].map(({ id, label, icon: Icon }) => (
                                <button key={id} onClick={() => setActiveTab(id as any)}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === id ? 'bg-surface-800 text-white shadow-lg border border-white/5' : 'text-surface-500 hover:text-surface-300'}`}>
                                    <Icon className="w-4 h-4 text-primary-500" />{label}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'form' && (
                            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-surface-500">عنوان النافذة:</span>
                                        <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="مثال: إضافة فرع" className={`${inp} w-52`} />
                                    </div>
                                    <button onClick={() => setFormFields(p => [...p, emptyField()])}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-xl transition-all">
                                        <Plus className="w-4 h-4" /> إضافة حقل
                                    </button>
                                </div>

                                {/* ── Discovery Banner ── */}
                                {discoveredCols.length > 0 && (
                                    <div className="bg-primary-950/20 border-b border-primary-900/30 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Wand2 className={`w-4 h-4 text-primary-400 ${discovering ? 'animate-spin' : 'animate-pulse'}`} />
                                                <span className="text-sm font-bold text-primary-400">
                                                    {discovering ? 'جاري فحص هيكل قاعدة البيانات...' : 'الاكتشاف الذكي للأعمدة (Smart Discovery):'}
                                                </span>
                                            </div>
                                            {discovering && <Loader2 className="w-4 h-4 animate-spin text-primary-400" />}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {discoveredCols
                                                .filter(dbCol => !formFields.some(f => f.key === dbCol.name))
                                                .map(dbCol => (
                                                    <button
                                                        key={dbCol.name}
                                                        onClick={() => importFromDb(dbCol.name)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-950 border border-primary-900/30 rounded-lg text-xs font-semibold text-primary-400 hover:bg-primary-600 hover:text-white transition-all shadow-lg group"
                                                    >
                                                        <Binary className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                                                        <span>{dbCol.name}</span>
                                                        <span className="mx-1 opacity-20">|</span>
                                                        <span className="text-[10px] opacity-70">{suggestLabel(dbCol.name)}</span>
                                                        <Plus className="w-3 h-3 ml-1" />
                                                    </button>
                                                ))
                                            }
                                            {discoveredCols.filter(dbCol => !formFields.some(f => f.key === dbCol.name)).length === 0 && (
                                                <span className="text-xs text-primary-400 italic">تم استيراد كافة الأعمدة المتاحة بنجاح.</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
                                    {formFields.length === 0 && (
                                        <p className="text-center text-surface-400 py-10">لا توجد حقول. اضغط "إضافة حقل" للبدء.</p>
                                    )}
                                    {formFields.map((field, i) => (
                                        <div key={i} className="flex gap-3 items-start bg-surface-800/20 rounded-xl p-4 border border-surface-800 transition-colors hover:border-surface-700">
                                            <div className="flex flex-col gap-1 pt-1">
                                                <button onClick={() => moveField(i, 'up')} disabled={i === 0} className="p-1 text-surface-400 hover:text-surface-700 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                                                <GripVertical className="w-4 h-4 text-surface-300 mx-auto" />
                                                <button onClick={() => moveField(i, 'down')} disabled={i === formFields.length - 1} className="p-1 text-surface-400 hover:text-surface-700 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                                            </div>
                                            <div className="flex-1 grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">الاسم الظاهر *</label>
                                                    <input value={field.label} onChange={e => updateField(i, 'label', e.target.value)} placeholder="مثال: اسم الموظف" className={inp} />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">الاسم البرمجي * <span className="text-surface-400">[EN]</span></label>
                                                    <input value={field.key} onChange={e => updateField(i, 'key', e.target.value.replace(/\s/g, '_').toLowerCase())} dir="ltr" placeholder="full_name" className={`${inp} font-mono`} />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">نوع الحقل</label>
                                                    <select value={field.type} onChange={e => updateField(i, 'type', e.target.value as FieldConfig['type'])} className={inp}>
                                                        {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">نص تلميحي</label>
                                                    <input value={field.placeholder || ''} onChange={e => updateField(i, 'placeholder', e.target.value)} className={inp} />
                                                </div>
                                                {field.type === 'select' && (
                                                    <div className="col-span-2">
                                                        <label className="text-xs font-medium text-surface-500 mb-1 block">مصدر البيانات <span className="text-primary-500">(اسم جدول)</span></label>
                                                        <input value={field.dataSource || ''} onChange={e => updateField(i, 'dataSource', e.target.value)} dir="ltr" placeholder="branches" className={`${inp} font-mono`} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-center gap-2 pt-1">
                                                <span className="text-xs text-surface-400">إجباري</span>
                                                <button onClick={() => updateField(i, 'required', !field.required)}>
                                                    {field.required ? <ToggleRight className="w-8 h-8 text-primary-500" /> : <ToggleLeft className="w-8 h-8 text-surface-300" />}
                                                </button>
                                                <button onClick={() => handleDeleteField(i)} className="p-2 text-red-500 hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-900/30">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── List Columns ── */}
                        {activeTab === 'list' && (
                            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-surface-500">عنوان الصفحة:</span>
                                        <input value={tableTitle} onChange={e => setTableTitle(e.target.value)} placeholder="مثال: إدارة الفروع" className={`${inp} w-52`} />
                                    </div>
                                    <button onClick={() => setListCols(p => [...p, emptyColumn()])}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-xl transition-all">
                                        <Plus className="w-4 h-4" /> إضافة عمود
                                    </button>
                                </div>
                                <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
                                    {listCols.length === 0 && (
                                        <p className="text-center text-surface-400 py-10">لا توجد أعمدة. اضغط "إضافة عمود" للبدء.</p>
                                    )}
                                    {listCols.map((col, i) => (
                                        <div key={i} className="flex gap-3 items-center bg-surface-800/20 rounded-xl p-4 border border-surface-800 transition-colors hover:border-surface-700">
                                            <div className="flex-1 grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">اسم العمود *</label>
                                                    <input value={col.label} onChange={e => updateCol(i, 'label', e.target.value)} className={inp} />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">الاسم البرمجي *</label>
                                                    <input value={col.key} onChange={e => updateCol(i, 'key', e.target.value.replace(/\s/g, '_').toLowerCase())} dir="ltr" className={`${inp} font-mono`} />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">نوع العرض</label>
                                                    <select value={col.type} onChange={e => updateCol(i, 'type', e.target.value as ColumnConfig['type'])} className={inp}>
                                                        {COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs text-surface-400">ترتيب</span>
                                                <button onClick={() => updateCol(i, 'sortable', !col.sortable)}>
                                                    {col.sortable ? <ToggleRight className="w-8 h-8 text-primary-500" /> : <ToggleLeft className="w-8 h-8 text-surface-300" />}
                                                </button>
                                            </div>
                                            <button onClick={() => setListCols(p => p.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-950/30 rounded-lg border border-transparent hover:border-red-900/30">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── KPI Cards ── */}
                        {activeTab === 'kpi' && (
                            <div className="space-y-4">
                                {/* Editor */}
                                <div className="bg-surface-900 rounded-2xl border border-surface-800 shadow-2xl overflow-hidden">
                                    <div className="p-5 border-b border-surface-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5 text-primary-500" />
                                            <span className="font-semibold text-white">تعريف بطاقات KPI الميدانية</span>
                                            <span className="text-xs text-surface-400 bg-surface-950 px-2 py-0.5 rounded-full border border-surface-800">تظهر في الشاشة الرئيسية</span>
                                        </div>
                                        <button
                                            onClick={() => setKpiCards(p => [...p, { label: '', table: selected?.table_name || '', aggregate: 'count', color: 'blue', icon: 'BarChart3' }])}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-xl transition-all">
                                            <Plus className="w-4 h-4" /> إضافة بطاقة
                                        </button>
                                    </div>
                                    <div className="p-5 space-y-3 max-h-[40vh] overflow-y-auto">
                                        {kpiCards.length === 0 && (
                                            <p className="text-center text-surface-400 py-8">لا توجد بطاقات. اضغط "إضافة بطاقة" للبدء.</p>
                                        )}
                                        {kpiCards.map((card, i) => (
                                            <div key={i} className="grid grid-cols-2 lg:grid-cols-3 gap-3 bg-surface-800/20 rounded-xl p-4 border border-surface-800 items-end">
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">العنوان *</label>
                                                    <input value={card.label} onChange={e => setKpiCards(p => { const a = [...p]; a[i] = { ...a[i], label: e.target.value }; return a; })} placeholder="بلاغات مفتوحة" className={inp} />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">الجدول</label>
                                                    <input dir="ltr" value={card.table} onChange={e => setKpiCards(p => { const a = [...p]; a[i] = { ...a[i], table: e.target.value }; return a; })} placeholder="tickets" className={`${inp} font-mono`} />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">التجميع</label>
                                                    <select value={card.aggregate} onChange={e => setKpiCards(p => { const a = [...p]; a[i] = { ...a[i], aggregate: e.target.value as any }; return a; })} className={inp}>
                                                        <option value="count">عدد (count)</option>
                                                        <option value="sum">مجموع (sum)</option>
                                                        <option value="avg">متوسط (avg)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">فلتر (column=value)</label>
                                                    <input dir="ltr" placeholder='{"status":"open"}' defaultValue={card.filter ? JSON.stringify(card.filter) : ''} onBlur={e => { try { setKpiCards(p => { const a = [...p]; a[i] = { ...a[i], filter: e.target.value ? JSON.parse(e.target.value) : undefined }; return a; }); } catch { } }} className={`${inp} font-mono text-xs`} />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">اللون</label>
                                                    <select value={card.color} onChange={e => setKpiCards(p => { const a = [...p]; a[i] = { ...a[i], color: e.target.value as any }; return a; })} className={inp}>
                                                        {['blue', 'red', 'green', 'amber', 'purple', 'teal'].map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">أيقونة Lucide</label>
                                                    <input dir="ltr" value={card.icon || ''} onChange={e => setKpiCards(p => { const a = [...p]; a[i] = { ...a[i], icon: e.target.value }; return a; })} placeholder="Wrench" className={`${inp} font-mono`} />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-xs font-medium text-surface-500 mb-1 block">رابط الانتقال (اختياري)</label>
                                                    <input dir="ltr" value={card.link_to || ''} onChange={e => setKpiCards(p => { const a = [...p]; a[i] = { ...a[i], link_to: e.target.value }; return a; })} placeholder="/tickets" className={`${inp} font-mono`} />
                                                </div>
                                                <div className="flex justify-end">
                                                    <button onClick={() => setKpiCards(p => p.filter((_, j) => j !== i))} className="px-3 py-2 text-red-500 hover:bg-red-950/30 border border-transparent hover:border-red-900/30 rounded-lg text-sm flex items-center gap-1 transition-colors">
                                                        <Trash2 className="w-4 h-4" /> حذف
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Live Preview */}
                                {kpiCards.length > 0 && (
                                    <div className="bg-surface-900 rounded-2xl border border-surface-800 shadow-2xl p-5">
                                        <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-4">معاينة حية</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                            {kpiCards.filter(c => c.label).map((card, i) => (
                                                <SovereignKPICard key={i} config={card} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Platform / SaaS Settings ── */}
                        {activeTab === 'nav' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-surface-900 rounded-2xl border border-surface-800 shadow-2xl overflow-hidden p-6 space-y-8">
                                <div className="flex items-center gap-3 border-b border-surface-800 pb-4">
                                    <Sparkles className="w-6 h-6 text-primary-500" />
                                    <div>
                                        <h3 className="font-bold text-lg text-white">إعدادات الظهور والوصول (SaaS Ready)</h3>
                                        <p className="text-sm text-surface-500">تحكم في كيفية ظهور هذه الواجهة في القائمة الجانبية ومن هم المسموح لهم بالوصول إليها.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Column 1: Appearance */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
                                            <Wand2 className="w-4 h-4" /> المظهر البصري
                                        </h4>
                                        <div>
                                            <label className="text-xs font-semibold text-surface-500 mb-1.5 block">أيقونة القائمة (Lucide Icon)</label>
                                            <div className="flex gap-2">
                                                <input dir="ltr" value={navConfig.icon} onChange={e => setNavConfig(p => ({ ...p, icon: e.target.value }))} className={`${inp} font-mono`} placeholder="Ticket, Users, Box..." />
                                                <div className="w-10 h-10 bg-primary-950 text-white rounded-xl flex items-center justify-center shrink-0 border border-primary-900/30">
                                                    {(() => {
                                                        const IconComp = (LucideIcons as any)[navConfig.icon] || (LucideIcons as any).Layout;
                                                        return <IconComp className="w-5 h-5 text-primary-600" />;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-surface-500 mb-1.5 block">اللون المميز</label>
                                            <select value={navConfig.color} onChange={e => setNavConfig(p => ({ ...p, color: e.target.value }))} className={inp}>
                                                {['blue', 'red', 'green', 'amber', 'purple', 'teal', 'indigo', 'rose'].map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-surface-800/20 rounded-2xl border border-surface-800 transition-all hover:border-primary-500/50 group">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors">عرض في القائمة الجانبية</p>
                                                <p className="text-xs text-surface-500">إذا تم الإيقاف، ستظل الصفحة متاحة عبر الرابط فقط.</p>
                                            </div>
                                            <button onClick={() => setNavConfig(p => ({ ...p, is_visible: !p.is_visible }))}>
                                                {navConfig.is_visible ? <ToggleRight className="w-10 h-10 text-primary-500" /> : <ToggleLeft className="w-10 h-10 text-surface-300" />}
                                            </button>
                                        </label>
                                    </div>

                                    {/* Column 2: Access Control */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4" /> التحكم في الوصول (RBAC)
                                        </h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            <label className="text-xs font-semibold text-surface-500 mb-1.5 block">الأدوار المسموح لها بالوصول</label>
                                            {[
                                                { id: 'admin', label: 'المدير العام' },
                                                { id: 'brand_ops_manager', label: 'مدير العمليات' },
                                                { id: 'maint_manager', label: 'مدير الصيانة' },
                                                { id: 'area_manager', label: 'مدير المنطقة' },
                                                { id: 'manager', label: 'مدير الفرع' },
                                                { id: 'technician', label: 'فني صيانة' }
                                            ].map(role => (
                                                <label key={role.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-800/20 hover:bg-surface-800 border border-transparent hover:border-surface-700 transition-all cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={navConfig.roles?.includes(role.id)}
                                                        onChange={e => {
                                                            const roles = e.target.checked
                                                                ? [...(navConfig.roles || []), role.id]
                                                                : (navConfig.roles || []).filter(r => r !== role.id);
                                                            setNavConfig(p => ({ ...p, roles }));
                                                        }}
                                                        className="w-4 h-4 accent-primary-600 rounded"
                                                    />
                                                    <span className="text-sm font-medium text-surface-300 group-hover:text-white">{role.label}</span>
                                                    <span className="text-[10px] font-mono opacity-40 ml-auto">{role.id}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* ── Save Bar ── */}
                        <div className="flex items-center justify-end gap-4">
                            {saveStatus !== 'idle' && (
                                <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2 border ${saveStatus === 'success' ? 'bg-green-950/20 text-green-400 border-green-900/30' : 'bg-red-950/20 text-red-400 border-red-900/30'}`}>
                                    {saveStatus === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                    {statusMsg}
                                </div>
                            )}
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-7 py-3 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-70">
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {saving ? 'جاري الحفظ والإضافة لـ DB...' : 'حفظ وتحديث قاعدة البيانات'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ══ New Schema Modal ══ */}
            {newSchemaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={() => setNewSchemaModal(false)} />
                    <div className="relative bg-surface-900 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden border border-surface-800">
                        <div className="flex items-center justify-between p-6 border-b border-surface-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-primary-950 text-white rounded-xl flex items-center justify-center border border-primary-900/30">
                                    <Plus className="w-5 h-5 text-primary-400" />
                                </div>
                                <h3 className="font-bold text-white">إنشاء جدول جديد</h3>
                            </div>
                            <button onClick={() => setNewSchemaModal(false)} className="p-2 text-surface-500 hover:text-white hover:bg-surface-800 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-surface-500 mb-1.5 block">اسم الجدول في قاعدة البيانات *</label>
                                <input dir="ltr" value={newTableName} onChange={e => setNewTableName(e.target.value.replace(/\s/g, '_').toLowerCase())}
                                    placeholder="مثال: equipment" className={`${inp} font-mono`} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-surface-500 mb-1.5 block">الاسم العربي للعرض</label>
                                <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)}
                                    placeholder="مثال: إدارة المعدات" className={inp} />
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-surface-950/50 rounded-xl border border-surface-800 hover:border-surface-700 transition-colors">
                                <input type="checkbox" checked={createDbTable} onChange={e => setCreateDbTable(e.target.checked)} className="w-4 h-4 accent-primary-600 bg-surface-900 border-surface-700" />
                                <div>
                                    <p className="text-sm font-semibold text-white">إنشاء الجدول في قاعدة البيانات الآن</p>
                                    <p className="text-xs text-surface-500">سيُنشأ بـ id, created_at, updated_at تلقائياً</p>
                                </div>
                            </label>
                        </div>
                        <div className="p-6 pt-0 flex justify-end gap-3">
                            <button onClick={() => setNewSchemaModal(false)} className="px-5 py-2.5 text-surface-400 font-medium hover:bg-surface-800 hover:text-white rounded-xl transition-colors">إلغاء</button>
                            <button onClick={handleAddSchema} disabled={addingSchema || !newTableName.trim()}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-70">
                                {addingSchema ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                                {createDbTable ? 'إنشاء الجدول وتسجيله' : 'تسجيل في المحرك فقط'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
