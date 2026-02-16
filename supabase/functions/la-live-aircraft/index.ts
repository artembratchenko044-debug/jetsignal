import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FR24_API_KEY = Deno.env.get("FR24_SANDBOX_API_KEY") ?? "";
const FR24_BASE_URL = "https://fr24api.flightradar24.com";

type AnyRecord = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeRecord = (row: unknown) => {
  if (Array.isArray(row)) {
    // Best-effort mapping for compact array payload variants.
    const lat = toNumber(row[1]);
    const lon = toNumber(row[2]);
    if (lat === null || lon === null) return null;
    return {
      callsign: typeof row[16] === "string" ? row[16] : null,
      flight: typeof row[13] === "string" ? row[13] : null,
      lat,
      lon,
      heading: toNumber(row[3]),
      altitude: toNumber(row[4]),
      speed: toNumber(row[5]),
      type: typeof row[8] === "string" ? row[8] : null,
      model: typeof row[9] === "string" ? row[9] : null,
      category: null,
    };
  }

  if (typeof row !== "object" || row === null) return null;
  const item = row as AnyRecord;

  const lat =
    toNumber(item.lat) ??
    toNumber(item.latitude) ??
    toNumber(item?.position_lat);
  const lon =
    toNumber(item.lon) ??
    toNumber(item.lng) ??
    toNumber(item.longitude) ??
    toNumber(item?.position_lon);

  if (lat === null || lon === null) return null;

  return {
    callsign:
      typeof item.callsign === "string"
        ? item.callsign
        : typeof item.flight === "string"
          ? item.flight
          : null,
    flight: typeof item.flight === "string" ? item.flight : null,
    lat,
    lon,
    heading: toNumber(item.heading),
    altitude: toNumber(item.altitude),
    speed: toNumber(item.speed) ?? toNumber(item.ground_speed),
    type:
      typeof item.aircraft_type === "string"
        ? item.aircraft_type
        : typeof item.type === "string"
          ? item.type
          : null,
    model: typeof item.model === "string" ? item.model : null,
    category:
      typeof item.category === "string"
        ? item.category
        : typeof item.aircraft_category === "string"
          ? item.aircraft_category
          : null,
  };
};

const unwrapDataArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object" && payload !== null) {
    const root = payload as AnyRecord;
    if (Array.isArray(root.data)) return root.data;
    if (Array.isArray(root.aircraft)) return root.aircraft;
    if (Array.isArray(root.results)) return root.results;
  }
  return [];
};

const fetchFlights = async () => {
  const pathCandidates = [
    "/api/sandbox/live/flight-positions/light?bounds=34.45,33.65,-118.85,-117.7&limit=300",
    "/api/sandbox/live/flight-positions/light?airports=LAX",
  ];

  for (const path of pathCandidates) {
    const response = await fetch(`${FR24_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${FR24_API_KEY}`,
        "x-apikey": FR24_API_KEY,
      },
    });

    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    const rows = unwrapDataArray(payload);
    const normalized = rows
      .map(normalizeRecord)
      .filter((item) => item !== null)
      .slice(0, 400);

    return normalized;
  }

  return [];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!FR24_API_KEY) {
    return json({ error: "Missing FR24_SANDBOX_API_KEY secret." }, 500);
  }

  try {
    const aircraft = await fetchFlights();
    return json({ aircraft, source: "flightradar24-sandbox" }, 200);
  } catch (error) {
    console.error("la-live-aircraft error:", error);
    return json({ error: "Failed to fetch aircraft." }, 500);
  }
});
