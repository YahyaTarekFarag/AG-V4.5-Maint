import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@shared/lib/supabase';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import { format } from 'date-fns';
import { Download, Upload, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { UISchema } from '../../types/schema';

export interface SovereignExportProps {
    tableName: string;
    schema: UISchema | null;
    dataLength: number;
    fetchAllRows: () => Promise<any[]>;
    onImportSuccess: () => void;
}

export default function SovereignExport({ tableName, schema, dataLength, fetchAllRows, onImportSuccess }: SovereignExportProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; errors: number; message?: string } | null>(null);

    const handleExport = async () => {
        try {
            const allRows = await fetchAllRows();
            const config = SOVEREIGN_REGISTRY[tableName];

            if (!allRows || allRows.length === 0) {
                alert('لا توجد بيانات للتصدير.');
                return;
            }

            const exportData = allRows.map(row => {
                const resolvedRow: any = {};

                schema?.list_config?.columns.forEach(col => {
                    if (!col.key) return; // TS Fix
                    let val = row[col.key];

                    if (config?.relationships?.[col.key]) {
                        const relTable = config.relationships[col.key];
                        // TS Fix: ensure col.key is a string before calling replace
                        const relObj = row[relTable] || row[col.key.replace('_id', '')];
                        if (relObj && typeof relObj === 'object') {
                            val = relObj.name || relObj.full_name || relObj.title || relObj.label || val;
                        }
                    }

                    if (col.type === 'status' && config?.formatting?.statusLabels) {
                        val = config.formatting.statusLabels[val] || val;
                    }

                    if ((col.type === 'date' || col.type === 'datetime') && val) {
                        try {
                            val = format(new Date(val), col.type === 'datetime' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
                        } catch { /* skip */ }
                    }

                    resolvedRow[col.label] = val;
                });
                return resolvedRow;
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sovereign Data");

            const colWidths = Object.keys(exportData[0]).map(key => ({
                wch: Math.max(key.length, ...exportData.map(r => String(r[key] || '').length).slice(0, 100)) + 2
            }));
            ws['!cols'] = colWidths;

            XLSX.writeFile(wb, `${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Export failed:', err);
            alert('فشل التصدير: ' + (err as Error).message);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportResult(null);

        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(ws);

            if (jsonData.length === 0) {
                setImportResult({ success: 0, errors: 0, message: 'الملف المرفق فارغ؛ لا توجد بيانات للمعالجة.' });
                return;
            }

            const labelToKey: Record<string, string> = {};
            const listCols = schema?.list_config?.columns;
            const formFields = schema?.form_config?.fields;

            if (listCols) listCols.forEach(c => { if (c.key) labelToKey[c.label] = c.key; });
            if (formFields) formFields.forEach((f: any) => { if (f.key) labelToKey[f.label] = f.key; });

            const mappedRows = jsonData.map(row => {
                const mapped: any = {};
                Object.entries(row).forEach(([header, value]) => {
                    const key = labelToKey[header] || header;
                    if (['id', 'created_at', 'updated_at', 'is_deleted'].includes(key)) return;
                    mapped[key] = value;
                });
                return mapped;
            });

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < mappedRows.length; i += 50) {
                const batch = mappedRows.slice(i, i + 50);
                const { error: insertError } = await supabase.from(tableName as any).insert(batch as any);
                if (insertError) {
                    console.error('Import batch error:', insertError);
                    errorCount += batch.length;
                } else {
                    successCount += batch.length;
                }
            }

            setImportResult({ success: successCount, errors: errorCount });
            if (successCount > 0) onImportSuccess();
        } catch (err: any) {
            setImportResult({ success: 0, errors: 0, message: 'خطأ في قراءة الملف: ' + err.message });
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <button
                onClick={handleExport}
                disabled={dataLength === 0}
                className="flex items-center gap-2 px-4 py-3 bg-surface-800 text-emerald-400 hover:bg-surface-700 rounded-2xl transition-all disabled:opacity-30 text-xs font-black border border-surface-700"
            >
                <Download className="w-4 h-4" />
                <span>تصدير</span>
            </button>
            <div className="relative group">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImport}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={importing}
                />
                <button className={clsx(
                    "flex items-center gap-2 px-4 py-3 bg-surface-800 text-blue-400 hover:bg-surface-700 rounded-2xl transition-all disabled:opacity-30 text-xs font-black border border-surface-700",
                    importing && "opacity-50"
                )}>
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>استيراد</span>
                </button>
            </div>

            {importResult && (
                <div className={clsx("absolute top-20 right-6 left-6 p-4 z-50 rounded-2xl flex items-center justify-between border shadow-2xl animate-in slide-in-from-top-2",
                    importResult.message ? "bg-amber-900/95 text-amber-400 border-amber-500/50" :
                        "bg-emerald-900/95 text-emerald-400 border-emerald-500/50")}>
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-bold">
                            {importResult.message || `تم بنجاح: ${importResult.success} | فشل: ${importResult.errors}`}
                        </span>
                    </div>
                    <button onClick={() => setImportResult(null)} className="text-xs font-black uppercase tracking-tighter hover:underline">إغلاق</button>
                </div>
            )}
        </>
    );
}
