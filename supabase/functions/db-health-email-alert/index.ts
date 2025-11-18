import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'node'
};

const smtp = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { subject, message } = body;

    // create mail transport
    const transporter = nodemailer.createTransport(smtp);

    await transporter.sendMail({
      from: `"AR System Monitor" <${process.env.SMTP_USER}>`,
      to: "info@alanranger.com",
      subject,
      html: message
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

