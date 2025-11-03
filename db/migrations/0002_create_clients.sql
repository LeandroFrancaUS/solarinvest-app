CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  address TEXT,
  uc TEXT,
  distribuidora TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients (email);