-- SQL for creating the storage_events table in Postgres / Neon
CREATE TABLE IF NOT EXISTS storage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  file_key TEXT NOT NULL,
  action TEXT,
  metadata JSONB,
  received_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: index for queries by file_key or user_id
CREATE INDEX IF NOT EXISTS idx_storage_events_file_key ON storage_events (file_key);
CREATE INDEX IF NOT EXISTS idx_storage_events_user_id ON storage_events (user_id);