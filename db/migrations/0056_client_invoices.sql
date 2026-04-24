-- Migration: 0056_client_invoices.sql
-- Creates client_invoices table for tracking utility invoices (faturas) per UC.
-- Each invoice is linked to a client and a consumer unit (UC).
-- Supports payment tracking and due date notifications.

BEGIN;

-- Create client_invoices table
CREATE TABLE IF NOT EXISTS public.client_invoices (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- UC reference (unidade consumidora)
  uc VARCHAR(50) NOT NULL,

  -- Invoice details
  invoice_number VARCHAR(100),
  reference_month DATE NOT NULL, -- YYYY-MM-01 format for the billing month
  due_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Payment tracking
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_receipt_number VARCHAR(100),
  payment_transaction_number VARCHAR(100),
  payment_attachment_url TEXT,
  confirmed_by_user_id VARCHAR(255),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('pendente', 'pago', 'confirmado', 'vencida')),
  CONSTRAINT positive_amount CHECK (amount >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_invoices_client_id ON public.client_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_uc ON public.client_invoices(uc);
CREATE INDEX IF NOT EXISTS idx_client_invoices_due_date ON public.client_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_client_invoices_payment_status ON public.client_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_client_invoices_reference_month ON public.client_invoices(reference_month);

-- Composite index for common queries (client + status)
CREATE INDEX IF NOT EXISTS idx_client_invoices_client_status ON public.client_invoices(client_id, payment_status);

-- Comments
COMMENT ON TABLE public.client_invoices IS 'Utility invoices (faturas) for each consumer unit (UC) of a client';
COMMENT ON COLUMN public.client_invoices.uc IS 'Consumer unit number (unidade consumidora)';
COMMENT ON COLUMN public.client_invoices.reference_month IS 'Billing month in YYYY-MM-01 format';
COMMENT ON COLUMN public.client_invoices.due_date IS 'Invoice due date';
COMMENT ON COLUMN public.client_invoices.payment_status IS 'Payment status: pendente, pago, confirmado, vencida';
COMMENT ON COLUMN public.client_invoices.confirmed_by_user_id IS 'User ID who confirmed the payment';

-- Create invoice notification configuration table
CREATE TABLE IF NOT EXISTS public.invoice_notification_config (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  organization_id VARCHAR(255),

  -- Notification thresholds (days before/after due date)
  days_before_due INTEGER[] DEFAULT ARRAY[7, 3, 1],
  notify_on_due_date BOOLEAN DEFAULT TRUE,
  days_after_due INTEGER[] DEFAULT ARRAY[1, 3, 5, 7],

  -- Notification preferences
  visual_notifications_enabled BOOLEAN DEFAULT TRUE,
  audio_notifications_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure only one config per user/org combination
  CONSTRAINT unique_user_config UNIQUE NULLS NOT DISTINCT (user_id, organization_id)
);

COMMENT ON TABLE public.invoice_notification_config IS 'Configuration for invoice due date notifications';
COMMENT ON COLUMN public.invoice_notification_config.days_before_due IS 'Array of days before due date to notify (e.g., [7, 3, 1])';
COMMENT ON COLUMN public.invoice_notification_config.days_after_due IS 'Array of days after due date to notify for overdue invoices';

COMMIT;
