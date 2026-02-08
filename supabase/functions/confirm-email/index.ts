import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const token = String(payload?.token ?? "").trim();

    if (!token) {
      return json({ error: "Token is required." }, 400);
    }

    const { data: record, error } = await supabaseAdmin
      .from("user_from_landing_page")
      .select("id, confirmed_at, confirm_expires_at")
      .eq("confirm_token", token)
      .maybeSingle();

    if (error) {
      return json({ error: error.message }, 500);
    }

    if (!record) {
      return json({ status: "expired" });
    }

    if (record.confirmed_at) {
      return json({ status: "already" });
    }

    if (record.confirm_expires_at) {
      const expiresAt = new Date(record.confirm_expires_at).getTime();
      if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
        return json({ status: "expired" });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("user_from_landing_page")
      .update({ confirmed_at: new Date().toISOString(), confirm_token: null })
      .eq("id", record.id);

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }

    return json({ status: "success" });
  } catch (error) {
    console.error("confirm-email error:", error);
    return json({ error: "Failed to confirm email." }, 500);
  }
});
