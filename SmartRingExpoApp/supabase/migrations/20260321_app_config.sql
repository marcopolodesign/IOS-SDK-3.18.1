CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with current latest firmware version
INSERT INTO app_config (key, value)
VALUES ('latest_firmware_version', '1.0.0')
ON CONFLICT (key) DO NOTHING;
