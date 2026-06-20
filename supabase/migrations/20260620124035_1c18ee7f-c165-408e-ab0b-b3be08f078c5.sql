
CREATE TABLE public.traffic_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  upload_bytes bigint NOT NULL DEFAULT 0,
  download_bytes bigint NOT NULL DEFAULT 0,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_usage TO authenticated;
GRANT ALL ON public.traffic_usage TO service_role;

ALTER TABLE public.traffic_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users manage traffic_usage"
  ON public.traffic_usage FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_traffic_usage_updated_at
  BEFORE UPDATE ON public.traffic_usage
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_traffic_usage_customer ON public.traffic_usage(customer_id);
CREATE INDEX idx_traffic_usage_period ON public.traffic_usage(period_start DESC);


CREATE TABLE public.blocked_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','package')),
  package_id uuid REFERENCES public.packages(id) ON DELETE CASCADE,
  domain text NOT NULL,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'global' AND package_id IS NULL) OR (scope = 'package' AND package_id IS NOT NULL))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_domains TO authenticated;
GRANT ALL ON public.blocked_domains TO service_role;

ALTER TABLE public.blocked_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users manage blocked_domains"
  ON public.blocked_domains FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_blocked_domains_updated_at
  BEFORE UPDATE ON public.blocked_domains
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_blocked_domains_scope ON public.blocked_domains(scope);
CREATE INDEX idx_blocked_domains_package ON public.blocked_domains(package_id);
