const SUPABASE_FUNCTION_URL =
  "https://wuhbaxesacmsdrrxzeuy.supabase.co/functions/v1/la-live-aircraft";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aGJheGVzYWNtc2Rycnh6ZXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODMyOTksImV4cCI6MjA4NjA1OTI5OX0.T7iBGB39MbsbNEso7W95ei020JXnjjOsULzBKnmcba8";

const LA_CENTER = [34.0522, -118.2437];
const statusChip = document.getElementById("status-chip");
const aircraftCount = document.getElementById("aircraft-count");
const lastUpdated = document.getElementById("last-updated");

const map = L.map("aircraft-map", {
  zoomControl: true,
  attributionControl: true,
}).setView(LA_CENTER, 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

const aircraftLayer = L.layerGroup().addTo(map);

const formatUpdatedTime = () => {
  const now = new Date();
  return now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const markerIcon = (heading = 0) =>
  L.divIcon({
    className: "",
    html: `<div class="aircraft-dot" style="transform: rotate(${heading}deg);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

const setStatus = (text) => {
  statusChip.textContent = text;
};

const renderAircraft = (aircraft = []) => {
  aircraftLayer.clearLayers();

  aircraft.forEach((flight) => {
    if (!Number.isFinite(flight.lat) || !Number.isFinite(flight.lon)) return;

    const marker = L.marker([flight.lat, flight.lon], {
      icon: markerIcon(flight.heading),
    });

    const title = flight.callsign || flight.flight || "Unknown flight";
    const altitude = Number.isFinite(flight.altitude)
      ? `${Math.round(flight.altitude)} ft`
      : "n/a";
    const speed = Number.isFinite(flight.speed)
      ? `${Math.round(flight.speed)} kt`
      : "n/a";

    marker.bindPopup(
      `<strong>${title}</strong><br/>Altitude: ${altitude}<br/>Speed: ${speed}`
    );

    marker.addTo(aircraftLayer);
  });

  aircraftCount.textContent = String(aircraft.length);
  lastUpdated.textContent = `Updated ${formatUpdatedTime()}`;
};

const renderFallback = () => {
  const fallbackFlights = [
    { callsign: "JS100", lat: 33.9416, lon: -118.4085, heading: 140 },
    { callsign: "JS204", lat: 34.1003, lon: -118.4108, heading: 210 },
    { callsign: "JS330", lat: 34.2138, lon: -118.358, heading: 65 },
  ];
  renderAircraft(fallbackFlights);
};

const refreshAircraft = async () => {
  setStatus("Syncing");
  try {
    const response = await fetch(SUPABASE_FUNCTION_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Unable to fetch aircraft data.");
    }

    renderAircraft(Array.isArray(data?.aircraft) ? data.aircraft : []);
    setStatus("Live");
  } catch (error) {
    console.error("Aircraft map error:", error);
    renderFallback();
    setStatus("Fallback");
    lastUpdated.textContent = "Showing demo aircraft";
  }
};

refreshAircraft();
setInterval(refreshAircraft, 30000);
