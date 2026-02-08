const form = document.getElementById("signup-form");
const emailInput = document.getElementById("email");
const submitButton = form.querySelector("button[type='submit']");
const successMessage = form.querySelector(".form-success");
const note = form.querySelector(".form-note");
const airportInput = document.getElementById("airport-search");
const airportSuggestions = document.getElementById("airport-suggestions");
const airportSelection = document.getElementById("airport-selection");

const SUPABASE_URL = "https://wuhbaxesacmsdrrxzeuy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aGJheGVzYWNtc2Rycnh6ZXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODMyOTksImV4cCI6MjA4NjA1OTI5OX0.T7iBGB39MbsbNEso7W95ei020JXnjjOsULzBKnmcba8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const setStatus = (message, isSuccess = false) => {
  successMessage.textContent = message;
  if (isSuccess) {
    form.classList.add("is-success");
  } else {
    form.classList.remove("is-success");
  }
};

const demoMessages = [
  {
    title: "RARE HEAVY INBOUND ✈️",
    body: "Rare alert: Boeing 747-8 is approaching LAX — ETA 6:18 PM.",
  },
  {
    title: "747 SPOTTED 👀",
    body: "Heads up! A Boeing 747-400 is on final near LAX. Don’t miss it.",
  },
  {
    title: "SPECIAL LIVERY 🎨",
    body: "Spotted: Alaska Airlines ‘Star Wars’ Boeing 737-900ER inbound to SEA — ETA 4:42 PM.",
  },
  {
    title: "SOUTHWEST RARE PAINT 🟦🟨",
    body: "Rare livery inbound: Southwest ‘Maryland One’ 737 MAX 8 approaching BWI — ETA 7:05 PM.",
  },
  {
    title: "DIVERTED IN 🔁",
    body: "Plot twist: United 1567 (Boeing 777-200) just diverted to DEN.",
  },
  {
    title: "RETURNING TO ORIGIN 🛬",
    body: "Update: Delta 982 (Airbus A330-300) turned back and is returning to JFK.",
  },
  {
    title: "SURPRISE ARRIVAL ⚡",
    body: "Unexpected traffic: Antonov An-124 just popped up near MIA — ETA 9:10 PM.",
  },
  {
    title: "ON FINAL NOW ✅",
    body: "It’s happening: Lufthansa 456 (Airbus A380) is on final into LAX — look up!",
  },
  {
    title: "RUNWAY SWITCH 🧭",
    body: "Runway change! American 32 (Boeing 787-9) now lining up for Runway 25L at LAX.",
  },
  {
    title: "LOW & LOUD 🔊",
    body: "Big bird incoming: Boeing C-17 Globemaster passing over In-N-Out LAX in ~8 min.",
  },
];

const feedContainer = document.getElementById("demo-feed");
const usedMessages = new Set();
let airportData = [];
let selectedAirport = null;

const pickMessage = () => {
  if (usedMessages.size === demoMessages.length) {
    usedMessages.clear();
  }
  let candidate = null;
  while (!candidate) {
    const next =
      demoMessages[Math.floor(Math.random() * demoMessages.length)];
    if (!usedMessages.has(next.title)) {
      candidate = next;
      usedMessages.add(next.title);
    }
  }
  return candidate;
};

const renderItem = (message) => {
  const card = document.createElement("div");
  card.className = "feed-item is-new";
  card.innerHTML = `<div class="feed-title">${message.title}</div><p class="feed-body">${message.body}</p>`;
  return card;
};

const pushMessage = () => {
  const message = pickMessage();
  const itemsBefore = Array.from(feedContainer.querySelectorAll(".feed-item"));
  const firstRects = new Map(
    itemsBefore.map((item) => [item, item.getBoundingClientRect()])
  );

  itemsBefore.forEach((item) => {
    item.classList.remove("is-new");
  });

  const card = renderItem(message);
  feedContainer.prepend(card);

  const itemsAfter = Array.from(feedContainer.querySelectorAll(".feed-item"));
  if (itemsAfter.length > 3) {
    itemsAfter[itemsAfter.length - 1].remove();
  }

  const itemsFinal = Array.from(feedContainer.querySelectorAll(".feed-item"));
  const lastRects = new Map(
    itemsFinal.map((item) => [item, item.getBoundingClientRect()])
  );

  itemsFinal.forEach((item) => {
    if (!firstRects.has(item)) return;
    const first = firstRects.get(item);
    const last = lastRects.get(item);
    const deltaY = first.top - last.top;
    if (deltaY !== 0) {
      item.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }],
        { duration: 420, easing: "ease" }
      );
    }
  });
};

const initDemoFeed = () => {
  if (!feedContainer) return;
  for (let i = 0; i < 3; i += 1) {
    pushMessage();
  }
  setInterval(pushMessage, 5200);
};

initDemoFeed();

const parseCSV = (text) => {
  const rows = [];
  let current = "";
  let inQuotes = false;
  const pushRow = (row) => {
    if (row.length) rows.push(row);
  };
  let row = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.length || row.length) {
        row.push(current);
        pushRow(row);
        row = [];
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    pushRow(row);
  }

  return rows;
};

const loadAirports = async () => {
  const response = await fetch("airports.csv");
  const text = await response.text();
  const rows = parseCSV(text);
  const header = rows.shift();
  if (!header) return;
  const getIndex = (name) => header.indexOf(name);

  const typeIndex = getIndex("type");
  const cityIndex = getIndex("municipality");
  const iataIndex = getIndex("iata_code");
  const nameIndex = getIndex("name");

  airportData = rows
    .filter((row) => {
      const type = row[typeIndex];
      const iata = row[iataIndex];
      return (
        (type === "large_airport" || type === "medium_airport") && iata
      );
    })
    .map((row) => ({
      type: row[typeIndex],
      city: row[cityIndex],
      iata: row[iataIndex],
      name: row[nameIndex],
    }))
    .filter((item) => item.city && item.iata && item.name);
};

const updateSelectionHint = (message, isError = false) => {
  airportSelection.textContent = message;
  airportSelection.classList.toggle("is-error", isError);
};

const renderSuggestions = (matches) => {
  airportSuggestions.innerHTML = "";
  if (!matches.length) {
    airportSuggestions.classList.remove("is-open");
    return;
  }
  matches.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-item";
    button.setAttribute("role", "option");
    button.innerHTML = `<div class="suggestion-title">${item.city} • ${item.iata}</div><div class="suggestion-sub">${item.name}</div>`;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectedAirport = item;
      airportInput.value = item.city;
      updateSelectionHint(`${item.iata} — ${item.name}`);
      airportSuggestions.classList.remove("is-open");
    });
    airportSuggestions.append(button);
  });
  airportSuggestions.classList.add("is-open");
};

const getMatches = (query) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const matches = airportData.filter((item) => {
    return (
      item.city.toLowerCase().includes(normalized) ||
      item.name.toLowerCase().includes(normalized) ||
      item.iata.toLowerCase().includes(normalized)
    );
  });
  return matches.slice(0, 6);
};

airportInput.addEventListener("input", () => {
  selectedAirport = null;
  updateSelectionHint("Select one airport.");
  const matches = getMatches(airportInput.value);
  renderSuggestions(matches);
});

airportInput.addEventListener("focus", () => {
  const matches = getMatches(airportInput.value);
  renderSuggestions(matches);
});

airportInput.addEventListener("blur", () => {
  setTimeout(() => {
    airportSuggestions.classList.remove("is-open");
  }, 120);
});

loadAirports().catch((error) => {
  console.error("Failed to load airports:", error);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  if (!email) return;
  if (!selectedAirport) {
    updateSelectionHint("Please select an airport from the list.", true);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Sending...";
  note.textContent = "Saving your spot...";

  const { error } = await supabaseClient
    .from("user_from_landing_page")
    .insert({
      email,
      iata_code: selectedAirport.iata,
      city: selectedAirport.city,
      airport_name: selectedAirport.name,
    });

  if (error) {
    if (error.code === "23505") {
      setStatus(
        "Looks like you’re already on the list 😄 Thanks for trying again — we’ll keep you posted!",
        true
      );
    } else {
      setStatus(
        `Something went wrong: ${error.message || "Please try again."}`,
        false
      );
      console.error("Supabase insert error:", error);
    }
    note.textContent = "No spam. Just launch updates.";
    submitButton.disabled = false;
    submitButton.textContent = "Notify me";
    return;
  }

  setStatus(
    "You’re in! 🎉 Check your inbox — we just sent you a quick confirmation email.",
    true
  );
  note.textContent = "No spam. Just launch updates.";
  submitButton.textContent = "Saved";
  emailInput.value = "";
  airportInput.value = "";
  selectedAirport = null;
  updateSelectionHint("Select one airport.");
  emailInput.blur();
});
