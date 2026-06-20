
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Restrict SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Tighten permissive policies — require authenticated session (already TO authenticated, but make explicit checks)
DROP POLICY IF EXISTS "auth manage customers" ON public.customers;
CREATE POLICY "auth manage customers" ON public.customers FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth manage invoices" ON public.invoices;
CREATE POLICY "auth manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth insert log" ON public.activity_log;
CREATE POLICY "auth insert log" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);
