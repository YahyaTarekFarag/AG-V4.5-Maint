-- Add financial fields to tickets table for Phase 12
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS parts_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS parts_used JSONB DEFAULT '[]'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN tickets.parts_used IS 'Detailed list of parts used: [{name, qty, cost_unit, total}]';
