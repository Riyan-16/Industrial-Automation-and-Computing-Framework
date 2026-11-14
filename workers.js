/*
  worker.js : runs on a separate thread.
  Receives a sensor reading, checks it against the safety limits,
  looks at the recent trend, and replies with a risk level + health score.
*/

const LIMITS = {
  temperature: { warn: 65, crit: 80, label: "Temperature" },
  pressure:    { warn: 7,  crit: 9,  label: "Pressure" },
  vibration:   { warn: 5,  crit: 7,  label: "Vibration" },
  machineLoad: { warn: 75, crit: 90, label: "Machine load" }
};

const history = [];   // the worker remembers recent readings

self.onmessage = function (event) {
  const d = event.data;

  history.push(d.temperature);
  if (history.length > 8) history.shift();

  let risk = "NORMAL";
  let score = 100;
  const reasons = [];

  for (const key in LIMITS) {
    const { warn, crit, label } = LIMITS[key];
    const value = d[key];

    if (value >= crit) {
      risk = "CRITICAL";
      score -= 25;
      reasons.push(label + " is above the critical limit (" + value + ")");
    } else if (value >= warn) {
      if (risk !== "CRITICAL") risk = "WARNING";
      score -= 10;
      reasons.push(label + " is above the warning limit (" + value + ")");
    }
  }

  // Trend: compare the newer half of the history with the older half
  let trend = "Not enough data for a trend yet.";
  if (history.length >= 6) {
    const half = history.length / 2;
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const diff = avg(history.slice(half)) - avg(history.slice(0, half));
    if (diff > 2)       trend = "Temperature is rising (+" + diff.toFixed(1) + " °C).";
    else if (diff < -2) trend = "Temperature is falling (" + diff.toFixed(1) + " °C).";
    else                trend = "Temperature is stable.";
  }

  self.postMessage({
    risk: risk,
    score: Math.max(score, 0),
    reasons: reasons,
    trend: trend,
    sentAt: d.sentAt          // echoed back so the main thread can time the round trip
  });
};
