// Sending emails through the Setwel server (api/send-email.php). The email comes from
// no-reply@setwelbusiness.co.za with the business owner's address as Reply-To, so
// customers' replies go straight to the owner.

import { apiPost } from './api';
import { LicenceInfo } from './licence';
import { Company, Customer, Invoice } from './types';
import { generateInvoicePdf } from '../utils/pdf';
import { getSetting, setSetting } from '../db/repository';

export interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  fromName: string;
  attachment?: { filename: string; base64: string };
}

export async function sendEmail(licence: LicenceInfo, req: EmailRequest): Promise<{ remaining?: number }> {
  return apiPost('send-email.php', { ...req }, licence);
}

export function invoicePdfAttachment(company: Company, customer: Customer | null, invoice: Invoice) {
  const dataUri = generateInvoicePdf(company, customer, invoice).output('datauristring');
  return { filename: `${invoice.invoiceNumber}.pdf`, base64: dataUri.split(',')[1] };
}

export function getBusinessEmail(companyId: string): string {
  return getSetting(companyId, 'businessEmail') || '';
}

export function setBusinessEmail(companyId: string, email: string) {
  setSetting(companyId, 'businessEmail', email.trim());
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
