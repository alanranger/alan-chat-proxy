import nodemailer from "npm:nodemailer@6.9.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const config = {
  runtime: 'node'
};

const smtp = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: Deno.env.get("SMTP_USER"),
    pass: Deno.env.get("SMTP_PASS")
  }
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export default async function handler(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { subject, message } = body;

    // create mail transport
    const transporter = nodemailer.createTransport(smtp);

    await transporter.sendMail({
      from: `"AR System Monitor" <${Deno.env.get("SMTP_USER")}>`,
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
