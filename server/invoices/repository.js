// server/invoices/repository.js
// Data access layer for client invoices.

/**
 * List all invoices for a client, ordered by due date descending
 */
export async function listClientInvoices(sql, clientId) {
  const rows = await sql`
    SELECT
      id,
      client_id,
      uc,
      invoice_number,
      reference_month,
      due_date,
      amount,
      payment_status,
      paid_at,
      payment_receipt_number,
      payment_transaction_number,
      payment_attachment_url,
      confirmed_by_user_id,
      notes,
      created_at,
      updated_at
    FROM public.client_invoices
    WHERE client_id = ${clientId}
    ORDER BY due_date DESC, reference_month DESC, id DESC
  `
  return rows
}

/**
 * Get a single invoice by ID
 */
export async function getInvoiceById(sql, invoiceId) {
  const rows = await sql`
    SELECT
      id,
      client_id,
      uc,
      invoice_number,
      reference_month,
      due_date,
      amount,
      payment_status,
      paid_at,
      payment_receipt_number,
      payment_transaction_number,
      payment_attachment_url,
      confirmed_by_user_id,
      notes,
      created_at,
      updated_at
    FROM public.client_invoices
    WHERE id = ${invoiceId}
  `
  return rows[0] || null
}

/**
 * Create a new invoice
 */
export async function createInvoice(sql, data) {
  const {
    client_id,
    uc,
    invoice_number = null,
    reference_month,
    due_date,
    amount,
    notes = null,
  } = data

  const rows = await sql`
    INSERT INTO public.client_invoices (
      client_id,
      uc,
      invoice_number,
      reference_month,
      due_date,
      amount,
      notes,
      payment_status,
      created_at,
      updated_at
    ) VALUES (
      ${client_id},
      ${uc},
      ${invoice_number},
      ${reference_month},
      ${due_date},
      ${amount},
      ${notes},
      'pendente',
      NOW(),
      NOW()
    )
    RETURNING *
  `
  return rows[0]
}

/**
 * Update an invoice
 */
export async function updateInvoice(sql, invoiceId, patch) {
  const allowedFields = [
    'invoice_number',
    'reference_month',
    'due_date',
    'amount',
    'payment_status',
    'notes',
  ]

  const updates = {}
  for (const key of allowedFields) {
    if (key in patch) {
      updates[key] = patch[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return getInvoiceById(sql, invoiceId)
  }

  updates.updated_at = sql`NOW()`

  const rows = await sql`
    UPDATE public.client_invoices
    SET ${sql(updates)}
    WHERE id = ${invoiceId}
    RETURNING *
  `
  return rows[0] || null
}

/**
 * Delete an invoice
 */
export async function deleteInvoice(sql, invoiceId) {
  const rows = await sql`
    DELETE FROM public.client_invoices
    WHERE id = ${invoiceId}
    RETURNING id
  `
  return rows.length > 0
}

/**
 * Register payment for an invoice
 */
export async function registerInvoicePayment(sql, invoiceId, paymentData) {
  const {
    payment_status,
    receipt_number = null,
    transaction_number = null,
    attachment_url = null,
    confirmed_by_user_id = null,
  } = paymentData

  // Determine paid_at value based on status
  const shouldSetPaidAt = payment_status === 'pago' || payment_status === 'confirmado'

  const rows = await sql`
    UPDATE public.client_invoices
    SET
      payment_status = ${payment_status},
      paid_at = ${shouldSetPaidAt ? sql`NOW()` : null},
      payment_receipt_number = ${receipt_number},
      payment_transaction_number = ${transaction_number},
      payment_attachment_url = ${attachment_url},
      confirmed_by_user_id = ${confirmed_by_user_id},
      updated_at = NOW()
    WHERE id = ${invoiceId}
    RETURNING *
  `
  return rows[0] || null
}

/**
 * Get invoice notification configuration for a user
 */
export async function getInvoiceNotificationConfig(sql, userId) {
  const rows = await sql`
    SELECT
      id,
      user_id,
      organization_id,
      days_before_due,
      notify_on_due_date,
      days_after_due,
      visual_notifications_enabled,
      audio_notifications_enabled,
      created_at,
      updated_at
    FROM public.invoice_notification_config
    WHERE user_id = ${userId}
  `

  // Return default config if none exists
  if (rows.length === 0) {
    return {
      days_before_due: [7, 3, 1],
      notify_on_due_date: true,
      days_after_due: [1, 3, 5, 7],
      visual_notifications_enabled: true,
      audio_notifications_enabled: true,
    }
  }

  return rows[0]
}

/**
 * Upsert invoice notification configuration
 */
export async function upsertInvoiceNotificationConfig(sql, userId, config) {
  const {
    days_before_due = [7, 3, 1],
    notify_on_due_date = true,
    days_after_due = [1, 3, 5, 7],
    visual_notifications_enabled = true,
    audio_notifications_enabled = true,
  } = config

  const rows = await sql`
    INSERT INTO public.invoice_notification_config (
      user_id,
      days_before_due,
      notify_on_due_date,
      days_after_due,
      visual_notifications_enabled,
      audio_notifications_enabled,
      created_at,
      updated_at
    ) VALUES (
      ${userId},
      ${sql.array(days_before_due)},
      ${notify_on_due_date},
      ${sql.array(days_after_due)},
      ${visual_notifications_enabled},
      ${audio_notifications_enabled},
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id)
    WHERE user_id IS NOT NULL AND organization_id IS NULL
    DO UPDATE SET
      days_before_due = EXCLUDED.days_before_due,
      notify_on_due_date = EXCLUDED.notify_on_due_date,
      days_after_due = EXCLUDED.days_after_due,
      visual_notifications_enabled = EXCLUDED.visual_notifications_enabled,
      audio_notifications_enabled = EXCLUDED.audio_notifications_enabled,
      updated_at = NOW()
    RETURNING *
  `
  return rows[0]
}

/**
 * Get invoice notifications based on configuration
 */
export async function getInvoiceNotifications(sql, config) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const daysBefore = config.days_before_due || []
  const daysAfter = config.days_after_due || []

  // Build date conditions for notifications
  const conditions = []

  // Days before due
  for (const days of daysBefore) {
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + days)
    conditions.push(targetDate.toISOString().split('T')[0])
  }

  // Due date today
  if (config.notify_on_due_date) {
    conditions.push(todayStr)
  }

  // Days after due (overdue)
  for (const days of daysAfter) {
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() - days)
    conditions.push(targetDate.toISOString().split('T')[0])
  }

  if (conditions.length === 0) {
    return []
  }

  const rows = await sql`
    SELECT
      inv.id,
      inv.client_id,
      inv.uc,
      inv.invoice_number,
      inv.reference_month,
      inv.due_date,
      inv.amount,
      inv.payment_status,
      c.name as client_name,
      EXTRACT(DAY FROM (inv.due_date - CURRENT_DATE)) as days_until_due
    FROM public.client_invoices inv
    INNER JOIN public.clients c ON c.id = inv.client_id
    WHERE inv.payment_status IN ('pendente', 'vencida')
      AND inv.due_date IN ${sql(conditions)}
    ORDER BY inv.due_date ASC
  `

  // Determine alert type
  return rows.map((row) => {
    const daysUntilDue = parseInt(row.days_until_due, 10)
    let alertType = 'a_vencer'
    if (daysUntilDue === 0) {
      alertType = 'vence_hoje'
    } else if (daysUntilDue < 0) {
      alertType = 'vencida'
    }
    return {
      ...row,
      alertType,
    }
  })
}
