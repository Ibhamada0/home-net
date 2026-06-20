
DROP POLICY IF EXISTS "auth users manage traffic_usage" ON public.traffic_usage;
DROP POLICY IF EXISTS "auth users manage blocked_domains" ON public.blocked_domains;

CREATE POLICY "read traffic_usage" ON public.traffic_usage
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write traffic_usage" ON public.traffic_usage
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update traffic_usage" ON public.traffic_usage
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete traffic_usage" ON public.traffic_usage
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "read blocked_domains" ON public.blocked_domains
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write blocked_domains" ON public.blocked_domains
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update blocked_domains" ON public.blocked_domains
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete blocked_domains" ON public.blocked_domains
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
