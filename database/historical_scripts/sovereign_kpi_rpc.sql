-- ==========================================
-- Sovereign Analytics Optimizer (Server-Side)
-- Implementation of Phase 1 Performance Fix
-- ==========================================

CREATE OR REPLACE FUNCTION public.sovereign_get_aggregate(
  p_table     text,
  p_aggregate text,    -- 'count' | 'sum' | 'avg'
  p_column    text DEFAULT 'id',
  p_filter    jsonb DEFAULT '{}'::jsonb
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_query text;
  v_result numeric;
  v_where text := 'is_deleted = false';
  v_key text;
  v_val text;
BEGIN
  -- 1. Build dynamic WHERE clause from JSON filter
  IF p_filter IS NOT NULL AND p_filter != '{}'::jsonb THEN
    FOR v_key, v_val IN SELECT * FROM jsonb_each_text(p_filter) LOOP
        v_where := v_where || format(' AND %I = %L', v_key, v_val);
    END LOOP;
  END IF;

  -- 2. Build and Execute Query
  IF p_aggregate = 'count' THEN
    v_query := format('SELECT count(*) FROM public.%I WHERE %s', p_table, v_where);
  ELSIF p_aggregate = 'sum' THEN
    v_query := format('SELECT COALESCE(sum(%I), 0) FROM public.%I WHERE %s', p_column, p_table, v_where);
  ELSIF p_aggregate = 'avg' THEN
    v_query := format('SELECT COALESCE(avg(%I), 0) FROM public.%I WHERE %s', p_column, p_table, v_where);
  ELSE
    RAISE EXCEPTION 'Invalid aggregate type: %', p_aggregate;
  END IF;

  EXECUTE v_query INTO v_result;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- Fallback if table doesn't exist or column missing
  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sovereign_get_aggregate TO authenticated;
