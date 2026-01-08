/**
 * Data Formatters for PDF Generation
 * 
 * Utilities to format dates, currency, CPF/CNPJ, and other data
 * for display in PDF documents.
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formats a number as Brazilian currency (R$)
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) {
    return '';
  }

  return numericValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formats a date to Brazilian format (DD/MM/YYYY)
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '';
  }
}

/**
 * Formats a date to extended format (e.g., "08 de janeiro de 2026")
 */
export function formatDateExtended(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return '';
  }
}

/**
 * Masks CPF (###.###.###-##) or CNPJ (##.###.###/####-##)
 */
export function maskCpfCnpj(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const digits = value.replace(/\D/g, '');
  
  if (!digits) {
    return '';
  }

  // CPF: 11 digits
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  // CNPJ: 14 digits
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formats a phone number to Brazilian format
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const digits = value.replace(/\D/g, '');
  
  if (!digits) {
    return '';
  }

  // Mobile: (##) #####-####
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  // Landline: (##) ####-####
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  return value;
}

/**
 * Formats a CEP to Brazilian format (#####-###)
 */
export function formatCep(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const digits = value.replace(/\D/g, '');
  
  if (!digits || digits.length !== 8) {
    return value;
  }

  return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * Normalizes a decimal number for display
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) {
    return '';
  }

  return numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Converts text to uppercase (for addresses, names in contracts)
 */
export function toUpperCase(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.trim().toUpperCase();
}

/**
 * Checks if a value is not empty (not null, undefined, or empty string after trim)
 */
export function isNotEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
}
