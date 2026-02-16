const SUPABASE_FUNCTION_URL =
  "https://wuhbaxesacmsdrrxzeuy.supabase.co/functions/v1/la-live-aircraft";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aGJheGVzYWNtc2Rycnh6ZXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODMyOTksImV4cCI6MjA4NjA1OTI5OX0.T7iBGB39MbsbNEso7W95ei020JXnjjOsULzBKnmcba8";

const LA_CENTER = [34.0522, -118.2437];
const CATEGORY_LABELS = [
  "Passenger",
  "Cargo",
  "Military and Government",
  "Business jets",
  "General aviation",
  "Helicopter",
  "Lighter-than-air",
  "Gliders",
  "Drones",
  "Ground vehicles",
];

const statusChip = document.getElementById("status-chip");
const aircraftCount = document.getElementById("aircraft-count");
const lastUpdated = document.getElementById("last-updated");
const categoryList = document.getElementById("category-list");
const allCategoriesCheckbox = document.getElementById("all-categories");
const aircraftSearch = document.getElementById("aircraft-search");
const aircraftList = document.getElementById("aircraft-list");

const selectedCategories = new Set(CATEGORY_LABELS);
const selectedAircraft = new Set();
let allFlights = [];
let aircraftSearchTerm = "";

const map = L.map("aircraft-map", {
  zoomControl: true,
  attributionControl: true,
}).setView(LA_CENTER, 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

const aircraftLayer = L.layerGroup().addTo(map);

const formatUpdatedTime = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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

const getFlightLabel = (flight) => {
  if (flight.callsign) return flight.callsign;
  if (flight.flight) return flight.flight;
  return "Unknown";
};

const inferCategory = (flight) => {
  const explicit = typeof flight.category === "string" ? flight.category.trim() : "";
  if (CATEGORY_LABELS.includes(explicit)) return explicit;

  const hint = `${flight.callsign || ""} ${flight.flight || ""} ${
    flight.type || ""
  } ${flight.model || ""}`.toUpperCase();

  if (/(UPS|FDX|CARGO|GTI|5X|FX|7L)/.test(hint)) return "Cargo";
  if (/(RCH|CFC|NAVY|AIR FORCE|MIL|GOV)/.test(hint))
    return "Military and Government";
  if (/(HELI|H\d\d|EC\d\d|AW\d\d|ROTOR)/.test(hint)) return "Helicopter";
  if (/(BIZ|LJ|GLF|E55P|C56X|FA\d\d|CL\d\d)/.test(hint)) return "Business jets";
  if (/(GLID|GLIDER)/.test(hint)) return "Gliders";
  if (/(DRONE|UAV)/.test(hint)) return "Drones";
  return "Passenger";
};

const normalizeIncomingFlights = (items) =>
  items.map((item) => ({
    ...item,
    category: inferCategory(item),
    label: getFlightLabel(item),
  }));

const getFilteredFlights = () =>
  allFlights.filter((flight) => {
    if (!selectedCategories.has(flight.category)) return false;
    if (selectedAircraft.size > 0 && !selectedAircraft.has(flight.label)) return false;
    return true;
  });

const renderAircraft = (flights) => {
  aircraftLayer.clearLayers();

  flights.forEach((flight) => {
    if (!Number.isFinite(flight.lat) || !Number.isFinite(flight.lon)) return;

    const marker = L.marker([flight.lat, flight.lon], {
      icon: markerIcon(flight.heading),
    });

    const altitude = Number.isFinite(flight.altitude)
      ? `${Math.round(flight.altitude)} ft`
      : "n/a";
    const speed = Number.isFinite(flight.speed) ? `${Math.round(flight.speed)} kt` : "n/a";

    marker.bindPopup(
      `<strong>${flight.label}</strong><br/>Category: ${flight.category}<br/>Altitude: ${altitude}<br/>Speed: ${speed}`
    );
    marker.addTo(aircraftLayer);
  });

  aircraftCount.textContent = String(flights.length);
  lastUpdated.textContent = `Updated ${formatUpdatedTime()}`;
};

const categoryItem = (label) => {
  const row = document.createElement("label");
  row.className = "filter-item";
  row.innerHTML = `<input type="checkbox" checked data-category="${label}" /><span>${label}</span>`;
  return row;
};

const renderCategoryFilters = () => {
  categoryList.innerHTML = "";
  CATEGORY_LABELS.forEach((label) => {
    categoryList.appendChild(categoryItem(label));
  });
};

const aircraftItem = (label) => {
  const checked = selectedAircraft.has(label) ? "checked" : "";
  const row = document.createElement("label");
  row.className = "filter-item";
  row.innerHTML = `<input type="checkbox" ${checked} data-aircraft="${label}" /><span>${label}</span>`;
  return row;
};

const renderAircraftFilter = () => {
  aircraftList.innerHTML = "";
  const labels = [...new Set(allFlights.map((f) => f.label))].sort();
  const filtered = labels.filter((label) =>
    label.toLowerCase().includes(aircraftSearchTerm.toLowerCase())
  );
  filtered.slice(0, 120).forEach((label) => {
    aircraftList.appendChild(aircraftItem(label));
  });
};

const refreshFilteredView = () => {
  renderAircraft(getFilteredFlights());
};

const wireFilterEvents = () => {
  allCategoriesCheckbox.addEventListener("change", () => {
    const checked = allCategoriesCheckbox.checked;
    selectedCategories.clear();
    CATEGORY_LABELS.forEach((label) => {
      const checkbox = categoryList.querySelector(`input[data-category="${label}"]`);
      if (checkbox) checkbox.checked = checked;
      if (checked) selectedCategories.add(label);
    });
    refreshFilteredView();
  });

  categoryList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const label = target.dataset.category;
    if (!label) return;

    if (target.checked) selectedCategories.add(label);
    else selectedCategories.delete(label);

    allCategoriesCheckbox.checked = selectedCategories.size === CATEGORY_LABELS.length;
    refreshFilteredView();
  });

  aircraftList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const label = target.dataset.aircraft;
    if (!label) return;
    if (target.checked) selectedAircraft.add(label);
    else selectedAircraft.delete(label);
    refreshFilteredView();
  });

  aircraftSearch.addEventListener("input", () => {
    aircraftSearchTerm = aircraftSearch.value.trim();
    renderAircraftFilter();
  });
};

const renderFallback = () => {
  allFlights = normalizeIncomingFlights([
    { callsign: "JS100", lat: 33.9416, lon: -118.4085, heading: 140, category: "Passenger" },
    { callsign: "UPS204", lat: 34.1003, lon: -118.4108, heading: 210, category: "Cargo" },
    { callsign: "RCH330", lat: 34.2138, lon: -118.358, heading: 65, category: "Military and Government" },
  ]);
  renderAircraftFilter();
  refreshFilteredView();
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
    if (!response.ok) throw new Error(data?.error || "Unable to fetch aircraft data.");

    const incoming = Array.isArray(data?.aircraft) ? data.aircraft : [];
    allFlights = normalizeIncomingFlights(incoming);
    renderAircraftFilter();
    refreshFilteredView();
    setStatus("Live");
  } catch (error) {
    console.error("Aircraft map error:", error);
    renderFallback();
    setStatus("Fallback");
    lastUpdated.textContent = "Showing demo aircraft";
  }
};

renderCategoryFilters();
wireFilterEvents();
refreshAircraft();
setInterval(refreshAircraft, 30000);
