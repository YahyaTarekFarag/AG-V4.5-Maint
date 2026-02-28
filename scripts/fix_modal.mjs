import fs from 'fs';

const filePath = 'c:\\AG V4.5\\src\\components\\sovereign\\SovereignActionModal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = "'asset_id', 'fault_type_id', 'downtime_start', 'submission_id', 'version'";
const replacementStr = "'asset_id', 'fault_type_id', 'downtime_start', 'submission_id', 'version',\n                'brand_id', 'sector_id', 'area_id', 'branch_id', 'category_id', 'assigned_to', 'ticket_id'";

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);

    // Also add schema.directBranchColumn
    const mapStr = "...schema.form_config.fields.map(f => f.key),";
    if (content.includes(mapStr) && !content.includes("schema.directBranchColumn")) {
        content = content.replace(mapStr, mapStr + "\n                schema.directBranchColumn,");
    }

    fs.writeFileSync(filePath, content);
    console.log("Successfully patched SovereignActionModal.tsx allowedKeys");
} else {
    console.log("Target string not found.");
}
