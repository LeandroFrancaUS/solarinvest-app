CREATE TABLE IF NOT EXISTS financial_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  analysis_name TEXT NOT NULL,
  mode TEXT CHECK (mode IN ('venda','leasing')) NOT NULL,
  payload_json JSONB NOT NULL,
  created_by_user_id TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_financial_analyses_client_id ON financial_analyses(client_id);
