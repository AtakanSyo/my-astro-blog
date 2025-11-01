// Load SunCalc from CDN
import "https://unpkg.com/suncalc@1.9.0/suncalc.js";

const TARGET_LUX = 80;
const MAX_LUX    = 100000;

const resultEl = document.getElementById("pluto-time");
const statusEl = document.getElementById("pluto-status");

function approxLuxFromAltitude(hDeg) {
  const h = hDeg * Math.PI/180;
  if (h > 0) {
    return MAX_LUX * Math.pow(Math.sin(h), 1.25);
  } else {
    return 400 * Math.exp(hDeg / 1.5);
  }
}

function findTimeForLux(date, lat, lon) {
  const times = SunCalc.getTimes(date, lat, lon);
  const candidates = [times.sunrise, times.sunset].filter(Boolean);
  let best = null;

  function searchAround(center) {
    let t0 = new Date(+center - 2*3600e3), t1 = new Date(+center + 2*3600e3);
    for (let i = 0; i < 40; i++) {
      const mid = new Date((+t0 + +t1) / 2);
      const alt = SunCalc.getPosition(mid, lat, lon).altitude * 180/Math.PI;
      const lux = approxLuxFromAltitude(alt);

      const alt0 = SunCalc.getPosition(t0, lat, lon).altitude * 180/Math.PI;
      const lux0 = approxLuxFromAltitude(alt0);

      if ((lux0 - TARGET_LUX) * (lux - TARGET_LUX) <= 0) {
        t1 = mid;
      } else {
        t0 = mid;
      }
      if (Math.abs(lux - TARGET_LUX) < 2) return mid;
    }
    return new Date((+t0 + +t1) / 2);
  }

  for (const c of candidates) {
    const hit = searchAround(c);
    if (!best || Math.abs(+hit - +date) < Math.abs(+best - +date)) best = hit;
  }
  return best;
}

function fmt(t) {
  return t ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function compute(lat, lon) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hit = findTimeForLux(today, lat, lon);

  resultEl.textContent = `Your Pluto Time today is: ${fmt(hit)}`;
  statusEl.textContent = `Latitude: ${lat.toFixed(4)}, Longitude: ${lon.toFixed(4)}`;
}

// Auto-location
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    pos => compute(pos.coords.latitude, pos.coords.longitude),
    () => {
      statusEl.textContent = "Location permission denied — enter coordinates instead.";
    }
  );
} else {
  statusEl.textContent = "Geolocation not supported — enter coordinates instead.";
}

// Manual lat/lon input
document.getElementById("coord-btn").addEventListener("click", () => {
  const lat = parseFloat(document.getElementById("lat-input").value);
  const lon = parseFloat(document.getElementById("lon-input").value);

  if (isNaN(lat) || isNaN(lon)) {
    statusEl.textContent = "Invalid coordinates — please enter numbers.";
    return;
  }

  compute(lat, lon);
});