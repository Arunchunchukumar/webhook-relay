/**
 * Email notification service.
 *
 * Sends email alerts via SMTP using nodemailer.
 * Supports both plain text and HTML content.
 */

import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return transporter;
}

/**
 * Send an email notification.
 *
 * @param subject - Email subject line
 * @param body - Plain text email body
 * @param to - Recipient email (defaults to SMTP_USER from config)
 */
export async function sendEmail(
  subject: string,
  body: string,
  to?: string,
): Promise<void> {
  if (!config.email.user || !config.email.pass) {
    console.warn('Email SMTP not configured, skipping notification');
    return;
  }

  const transport = getTransporter();

  await transport.sendMail({
    from: config.email.from || config.email.user,
    to: to ?? config.email.user,
    subject,
    text: body,
  });
}
