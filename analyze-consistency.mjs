import fs from 'fs';

const dna = JSON.parse(fs.readFileSync('database_dna_reality.json', 'utf8'));
const uiSchemas = JSON.parse(fs.readFileSync('ui_schemas_dump.json', 'utf8'));

const report = {
    summaries: {},
    conflicts: [],
    matrix: {}
};

for (const tableName in dna) {
    const actualCols = dna[tableName].map(c => c.column_name);
    const uiSchema = uiSchemas.find(s => s.table_name === tableName);

    report.matrix[tableName] = {
        actual_columns: actualCols,
        ui_schema_fields: [],
        mismatches: []
    };

    if (uiSchema) {
        const formFields = uiSchema.form_config?.fields || [];
        const listCols = uiSchema.list_config?.columns || [];

        const allUiKeys = new Set([...formFields.map(f => f.key), ...listCols.map(c => c.key)]);
        report.matrix[tableName].ui_schema_fields = Array.from(allUiKeys);

        allUiKeys.forEach(key => {
            if (!actualCols.includes(key)) {
                report.matrix[tableName].mismatches.push({
                    key,
                    status: '❌ MISSING IN DB',
                    context: 'UI Schema references a column that does not exist in the real table.'
                });
                report.conflicts.push({ table: tableName, key, error: 'MISSING_IN_DB' });
            }
        });

        actualCols.forEach(col => {
            if (!allUiKeys.has(col) && !['created_at', 'updated_at', 'is_deleted', 'id', 'version'].includes(col)) {
                report.matrix[tableName].mismatches.push({
                    key: col,
                    status: '⚠️ ORPHAN IN DB',
                    context: 'Column exists in DB but is not utilized in UI Schema (Form or List).'
                });
            }
        });
    } else {
        report.matrix[tableName].status = '🚫 NO UI SCHEMA REGISTERED';
        report.conflicts.push({ table: tableName, error: 'MISSING_UI_SCHEMA' });
    }
}

fs.writeFileSync('consistency_matrix_report.json', JSON.stringify(report, null, 2));
console.log("Consistency Matrix Generated: consistency_matrix_report.json");
