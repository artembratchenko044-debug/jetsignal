import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
const SENDGRID_TEMPLATE_ID = Deno.env.get("SENDGRID_TEMPLATE_ID") ?? "";
const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "";
const CONFIRM_URL_BASE = Deno.env.get("CONFIRM_URL_BASE") ?? "";
const CONFIRM_TTL_HOURS = Number(Deno.env.get("CONFIRM_TTL_HOURS") ?? "24");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const sendEmail = async (to: string, confirmUrl: string) => {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: SENDGRID_FROM_EMAIL },
      personalizations: [
        {
          to: [{ email: to }],
          dynamic_template_data: {
            confirm_url: confirmUrl,
          },
        },
      ],
      template_id: SENDGRID_TEMPLATE_ID,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "SendGrid error");
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const email = String(payload?.email ?? "").trim().toLowerCase();
    const iataCode = String(payload?.iata_code ?? "").trim().toUpperCase();
    const city = String(payload?.city ?? "").trim();
    const airportName = String(payload?.airport_name ?? "").trim();

    if (!email) {
      return json({ error: "Email is required." }, 400);
    }

    if (!iataCode || !city || !airportName) {
      return json({ error: "Airport selection is required." }, 400);
    }

    const { data: existing, error: selectError } = await supabaseAdmin
      .from("user_from_landing_page")
      .select("id, confirmed_at")
      .eq("email", email)
      .maybeSingle();

    if (selectError) {
      return json({ error: selectError.message }, 500);
    }

    if (existing?.confirmed_at) {
      return json({ status: "already" });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + CONFIRM_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("user_from_landing_page")
        .update({
          confirm_token: token,
          confirm_expires_at: expiresAt,
          iata_code: iataCode,
          city,
          airport_name: airportName,
        })
        .eq("id", existing.id);

      if (updateError) {
        return json({ error: updateError.message }, 500);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("user_from_landing_page")
        .insert({
          email,
          iata_code: iataCode,
          city,
          airport_name: airportName,
          confirm_token: token,
          confirm_expires_at: expiresAt,
        });

      if (insertError) {
        return json({ error: insertError.message }, 500);
      }
    }

    const confirmUrl = `${CONFIRM_URL_BASE}?token=${token}`;
    await sendEmail(email, confirmUrl);

    return json({ status: "sent" });
  } catch (error) {
    console.error("send-confirmation error:", error);
    return json({ error: "Failed to send confirmation." }, 500);
  }
});
