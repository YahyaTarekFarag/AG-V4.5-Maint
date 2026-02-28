import fs from 'fs';

const calls = JSON.parse(fs.readFileSync('supabase_calls_audit.json', 'utf8'));
const dna = JSON.parse(fs.readFileSync('database_dna_reality.json', 'utf8'));
const matrix = JSON.parse(fs.readFileSync('consistency_matrix_report.json', 'utf8'));

const atomicConflicts = [];

calls.forEach(call => {
    if (call.type === 'TABLE_OP') {
        const table = call.table;
        if (!dna[table]) {
            atomicConflicts.push({
                file: call.file,
                line: call.line,
                table: table,
                error: 'TABLE_NOT_FOUND_IN_DB',
                severity: 'CRITICAL'
            });
        } else {
            // Check if context contains explicit columns that are missing
            const actualCols = dna[table].map(c => c.column_name);
            const selectMatch = call.context?.match(/\.select\(['"](.+?)['"]\)/);
            if (selectMatch) {
                const requested = selectMatch[1].split(',').map(s => s.trim().split('(')[0].split('!')[0]);
                requested.forEach(req => {
                    if (req !== '*' && !actualCols.includes(req) && !req.includes(':') && !req.includes('.')) {
                        atomicConflicts.push({
                            file: call.file,
                            line: call.line,
                            table: table,
                            column: req,
                            error: 'EXPLICIT_COLUMN_MISSING_IN_DB',
                            severity: 'CRITICAL'
                        });
                    }
                });
            }
        }
    }
});

// Also add UI Schema conflicts which affect Sovereign components
matrix.conflicts.forEach(conflict => {
    atomicConflicts.push({
        table: conflict.table,
        column: conflict.key,
        error: 'UI_SCHEMA_DB_MISMATCH',
        severity: 'HIGH',
        context: 'Sovereign components will fail when writing to this field.'
    });
});

fs.writeFileSync('atomic_conflicts_report.json', JSON.stringify(atomicConflicts, null, 2));
console.log(`Generated atomic_conflicts_report.json with ${atomicConflicts.length} issues.`);
