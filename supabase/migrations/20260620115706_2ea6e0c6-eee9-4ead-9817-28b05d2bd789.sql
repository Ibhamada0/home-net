ALTER TABLE public.router_config 
  ADD COLUMN IF NOT EXISTS connection_mode TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS cloud_hostname TEXT,
  ADD CONSTRAINT router_connection_mode_chk CHECK (connection_mode IN ('local','cloud'));