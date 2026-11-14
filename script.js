"use strict";
/*
  Ironline : Industrial Automation & Computing Framework
  Demonstrates: process management, thread (core) simulation, CPU scheduling,
  priority + aging, parallel processing (Web Worker), synchronization (mutex),
  real-time monitoring.
*/

const $ = id => document.getElementById(id);
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const CORES = 4, GANTT_LEN = 40, TICK_MS = 600;
const POLICY = { priority: "Priority", rr: "Round Robin", fcfs: "FCFS" };

/* ---------- sensors ---------- */
const labels = { temperature: "Temperature", pressure: "Pressure", vibration: "Vibration", machineLoad: "Machine load" };
const sensors = {
  temperature: { v: 58, unit: "°C",   warn: 65, crit: 80, min: 45, max: 95,  dec: 1, hist: [] },
  pressure:    { v: 5.5, unit: "bar",  warn: 7,  crit: 9,  min: 3,  max: 11,  dec: 1, hist: [] },
  vibration:   { v: 3,  unit: "mm/s", warn: 5,  crit: 7,  min: 1,  max: 9,   dec: 1, hist: [] },
  machineLoad: { v: 55, unit: "%",    warn: 75, crit: 90, min: 35, max: 100, dec: 0, hist: [] }
};

/* ---------- system state ---------- */
const S = {
  running: false, pid: 1, seq: 0, tick: 0, done: 0, startedAt: 0,
  procs: [], cores: Array(CORES).fill(null), lock: null,
  algo: "priority", quantum: 3,
  rtSum: 0, rtN: 0, emergency: 0, lastRisk: "NORMAL", unread: 0, view: "dashboard"
};
const gantt = Array.from({ length: CORES }, () => []);
const alerts = [];

const TEMPLATES = [
  { name: "Sensor Acquisition", priority: 3 },
  { name: "Data Processing",    priority: 4 },
  { name: "System Monitoring",  priority: 2 },
  { name: "Alert Detection",    priority: 1 },
  { name: "Control Module",     priority: 2, lock: true }
];

/* ---------- web worker ---------- */
let worker = null;
try {
  worker = new Worker("worker.js");
  worker.onmessage = onAnalysis;
  worker.onerror = () => createAlert("crit", "Worker failed to load. Run the project through a local server.");
} catch (e) {
  createAlert("crit", "Web Worker blocked. Open the project with a local server, not as a file.");
}

/* ---------- navigation ---------- */
const titles = {
  dashboard: ["Dashboard", "Live plant overview"],
  scheduler: ["Scheduler", "How the CPU cores are being shared"],
  processes: ["Processes", "Every task the system has created"],
  alerts:    ["Alerts", "Events and warnings"],
  concepts:  ["Concepts", "Where each computing idea appears in this project"]
};
$("nav").addEventListener("click", e => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  const v = btn.dataset.view;
  S.view = v;
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b === btn));
  document.querySelectorAll(".view").forEach(s => s.classList.toggle("active", s.id === "view-" + v));
  $("viewTitle").textContent = titles[v][0];
  $("viewSub").textContent = titles[v][1];
  if (v === "alerts") { S.unread = 0; renderAlerts(); }
});

/* ---------- sensor cards ---------- */
$("sensorGrid").innerHTML = Object.keys(sensors).map(k => `
  <article class="card sensor">
    <header><span>${labels[k]}</span><b class="tag" id="tag-${k}">--</b></header>
    <div class="reading"><span id="val-${k}">--</span><small>${sensors[k].unit}</small></div>
    <canvas id="spark-${k}" width="260" height="56"></canvas>
  </article>`).join("");

const statusOf = s => s.v >= s.crit ? "crit" : s.v >= s.warn ? "warn" : "ok";
const statusText = { ok: "Normal", warn: "Warning", crit: "Critical" };
const statusColor = { ok: "#6db36d", warn: "#e0b341", crit: "#d9604e" };

function stepSensors() {
  for (const k in sensors) {
    const s = sensors[k], range = s.max - s.min;
    const base = s.min + (s.warn - s.min) * 0.6;
    if (S.emergency > 0 && k !== "pressure") {
      s.v = s.crit + Math.random() * range * 0.08;           // forced fault
    } else {
      s.v += (base - s.v) * 0.08 + (Math.random() - 0.5) * range * 0.12;
      if (Math.random() < 0.08) s.v += range * 0.22;          // occasional bump
    }
    s.v = Math.min(s.max, Math.max(s.min, s.v));
    s.hist.push(s.v);
    if (s.hist.length > 30) s.hist.shift();
  }
  if (S.emergency > 0) S.emergency--;
}

function renderSensors() {
  for (const k in sensors) {
    const s = sensors[k], st = statusOf(s);
    $("val-" + k).textContent = s.v.toFixed(s.dec);
    const tag = $("tag-" + k);
    tag.textContent = statusText[st];
    tag.className = "tag " + st;
    drawSpark(k, st);
  }
}

function drawSpark(k, st) {
  const s = sensors[k], c = $("spark-" + k), g = c.getContext("2d");
  const w = c.width, h = c.height, y = v => h - 4 - ((v - s.min) / (s.max - s.min)) * (h - 8);
  g.clearRect(0, 0, w, h);
  g.setLineDash([4, 4]); g.lineWidth = 1;
  [[s.warn, "#e0b34166"], [s.crit, "#d9604e66"]].forEach(([val, col]) => {
    g.strokeStyle = col; g.beginPath(); g.moveTo(0, y(val)); g.lineTo(w, y(val)); g.stroke();
  });
  g.setLineDash([]); g.strokeStyle = statusColor[st]; g.lineWidth = 2; g.beginPath();
  s.hist.forEach((v, i) => {
    const x = (i / 29) * w;
    i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v));
  });
  g.stroke();
}

/* ---------- worker result ---------- */
function onAnalysis(e) {
  const r = e.data;
  S.rtSum += performance.now() - r.sentAt; S.rtN++;
  $("healthScore").textContent = r.score;
  $("healthBar").style.width = r.score + "%";
  $("riskBadge").textContent = r.risk;
  $("riskBadge").className = "risk " + r.risk;
  $("trendText").textContent = r.trend;
  $("reasons").innerHTML = r.reasons.map(t => `<li>• ${t}</li>`).join("");

  if (r.risk !== S.lastRisk) {
    if (r.risk === "CRITICAL") createAlert("crit", r.reasons[0] || "Critical condition detected.");
    else if (r.risk === "WARNING") createAlert("warn", r.reasons[0] || "Warning level reached.");
    else createAlert("info", "All readings are back within normal limits.");
    S.lastRisk = r.risk;
  }
}

/* ---------- processes ---------- */
function addProcess(name, priority, lock = false, burst) {
  const p = {
    pid: S.pid++, name, priority: priority ?? rand(1, 10), burst: burst ?? rand(2, 8),
    state: "READY", core: null, wait: 0, slice: 0, lock, seq: S.seq++
  };
  p.remaining = p.burst;
  S.procs.push(p);
  return p;
}

function pickNext() {
  const q = S.procs.filter(p => p.state === "READY" || p.state === "BLOCKED");
  if (S.algo === "priority") {
    // aging: every 8 ticks of waiting improves priority by 1
    q.sort((a, b) => (a.priority - a.wait / 8) - (b.priority - b.wait / 8) || a.seq - b.seq);
  } else {
    q.sort((a, b) => a.seq - b.seq);
  }
  for (const p of q) {
    if (p.lock && S.lock !== null && S.lock !== p.pid) {
      if (p.state !== "BLOCKED") {
        p.state = "BLOCKED";
        createAlert("info", `PID ${p.pid} ${p.name} blocked, actuator held by PID ${S.lock}.`);
      }
      continue;
    }
    return p;
  }
  return null;
}

function dispatch(p, i) {
  p.state = "RUNNING"; p.core = i; p.slice = 0;
  S.cores[i] = p;
  if (p.lock) S.lock = p.pid;
}
function release(p) { if (S.lock === p.pid) S.lock = null; }

function schedulerTick() {
  if (!S.running) return;
  S.tick++;

  S.cores.forEach((p, i) => {
    if (!p) return;
    p.remaining--; p.slice++;
    if (p.remaining <= 0) {
      p.state = "COMPLETED"; S.cores[i] = null; release(p); S.done++;
    } else if (S.algo === "rr" && p.slice >= S.quantum) {
      p.state = "READY"; p.seq = S.seq++; S.cores[i] = null; release(p);   // back of the queue
    }
  });

  for (let i = 0; i < CORES; i++) {
    if (!S.cores[i]) { const n = pickNext(); if (n) dispatch(n, i); }
  }

  S.procs.forEach(p => { if (p.state === "READY" || p.state === "BLOCKED") p.wait++; });
  S.cores.forEach((p, i) => {
    gantt[i].push(p ? p.pid : null);
    if (gantt[i].length > GANTT_LEN) gantt[i].shift();
  });

  prune();
  renderAll();
}

function prune() {
  const old = S.procs.filter(p => p.state === "COMPLETED" || p.state === "STOPPED");
  if (old.length > 12) {
    const drop = new Set(old.slice(0, old.length - 12));
    S.procs = S.procs.filter(p => !drop.has(p));
  }
}

/* ---------- sensor cycle ---------- */
function readSensors() {
  stepSensors();
  renderSensors();
  if (worker) worker.postMessage({
    temperature: sensors.temperature.v, pressure: sensors.pressure.v,
    vibration: sensors.vibration.v, machineLoad: sensors.machineLoad.v,
    sentAt: performance.now()
  });
}

function sensorCycle() {
  if (!S.running) return;
  readSensors();
  addProcess("Sensor Acquisition", 3, false, rand(2, 4));
  const waiting = S.procs.filter(p => p.state === "READY" || p.state === "BLOCKED").length;
  if (Math.random() < 0.5 && waiting < 14) {
    const t = TEMPLATES[rand(1, 4)];
    addProcess(t.name, t.priority, !!t.lock);
  }
}

/* ---------- rendering ---------- */
const pidColor = pid => `hsl(${(pid * 57) % 360} 40% 52%)`;

function renderAll() {
  renderStats(); renderProcesses(); renderCores(); renderGantt(); renderQueue();
}

function renderStats() {
  const active = S.procs.filter(p => ["READY", "RUNNING", "BLOCKED"].includes(p.state)).length;
  const busy = S.cores.filter(Boolean).length;
  $("activeProcesses").textContent = active;
  $("completedTasks").textContent = S.done;
  $("responseTime").textContent = S.rtN ? (S.rtSum / S.rtN).toFixed(2) + " ms" : "-- ms";
  const pct = busy * (100 / CORES);
  $("cpuUsage").textContent = pct + "%";
  $("cpuBar").style.width = pct + "%";
  $("coresMini").innerHTML = S.cores.map((p, i) =>
    `<div class="${p ? "busy" : ""}">C${i}${p ? " · P" + p.pid : ""}</div>`).join("");
  $("mutexState").textContent = S.lock ? "HELD by PID " + S.lock : "FREE";
  $("mutexState").className = S.lock ? "held" : "free";
}

function renderProcesses() {
  $("processTable").innerHTML = [...S.procs].reverse().map(p => {
    const done = ((p.burst - Math.max(p.remaining, 0)) / p.burst) * 100;
    return `<tr>
      <td>${p.pid}</td>
      <td>${p.name}${p.lock ? '<em class="lk">mutex</em>' : ""}</td>
      <td>${p.priority}</td><td>${p.burst}</td>
      <td><div class="mini"><i style="width:${done}%"></i></div></td>
      <td><span class="st ${p.state.toLowerCase()}">${p.state}</span></td>
      <td>${p.state === "RUNNING" ? "Core " + p.core : "-"}</td>
      <td>${p.wait}</td></tr>`;
  }).join("") || `<tr><td colspan="8" class="empty">No processes yet. Start the system.</td></tr>`;
}

function renderCores() {
  $("coreList").innerHTML = S.cores.map((p, i) => `
    <div class="core">Core ${i}: ${p ? `${p.name} <b>PID ${p.pid}</b>` : "<span style='color:var(--muted)'>idle</span>"}
      <div class="bar"><i style="width:${p ? ((p.burst - p.remaining) / p.burst) * 100 : 0}%"></i></div>
    </div>`).join("");
}

function renderGantt() {
  $("gantt").innerHTML = gantt.map((row, i) => `
    <div class="g-row"><span>Core ${i}</span><div class="g-cells">
      ${row.map(pid => pid === null ? '<i class="idle"></i>'
        : `<i style="background:${pidColor(pid)}" title="PID ${pid}"></i>`).join("")}
    </div></div>`).join("");
}

function renderQueue() {
  const q = S.procs.filter(p => p.state === "READY" || p.state === "BLOCKED");
  if (S.algo === "priority") q.sort((a, b) => (a.priority - a.wait / 8) - (b.priority - b.wait / 8) || a.seq - b.seq);
  else q.sort((a, b) => a.seq - b.seq);
  $("queue").innerHTML = q.map(p =>
    `<span class="chip ${p.state === "BLOCKED" ? "blocked" : ""}">P${p.pid} · pr ${p.priority}</span>`).join("")
    || '<span class="empty">Queue is empty.</span>';
}

/* ---------- alerts ---------- */
function createAlert(level, msg) {
  alerts.unshift({ level, msg, time: new Date().toLocaleTimeString() });
  if (alerts.length > 60) alerts.pop();
  if (level !== "info" && S.view !== "alerts") S.unread++;
  renderAlerts();
}

function renderAlerts() {
  const item = a => `<li class="alert ${a.level}"><time>${a.time}</time><span>${a.msg}</span></li>`;
  const empty = '<li class="empty">Nothing to show.</li>';
  $("recentAlerts").innerHTML = alerts.slice(0, 4).map(item).join("") || empty;
  const f = $("alertFilter").value;
  $("alertLog").innerHTML = alerts.filter(a => f === "all" || a.level === f).map(item).join("") || empty;
  const b = $("alertBadge");
  b.hidden = S.unread === 0;
  b.textContent = S.unread > 9 ? "9+" : S.unread;
}

/* ---------- controls ---------- */
function startSystem() {
  if (S.running) return;
  S.running = true; S.startedAt = Date.now();
  $("systemStatus").textContent = "SYSTEM ONLINE";
  $("statusDot").classList.add("on");
  $("btnStart").disabled = true; $("btnStop").disabled = false;
  createAlert("info", "System started.");
  sensorCycle();
  TEMPLATES.slice(1).forEach(t => addProcess(t.name, t.priority, !!t.lock));
  renderAll();
}

function stopSystem() {
  if (!S.running) return;
  S.running = false;
  S.procs.forEach(p => { if (["READY", "RUNNING", "BLOCKED"].includes(p.state)) p.state = "STOPPED"; });
  S.cores.fill(null); S.lock = null;
  $("systemStatus").textContent = "SYSTEM OFFLINE";
  $("statusDot").classList.remove("on");
  $("btnStart").disabled = false; $("btnStop").disabled = true;
  createAlert("info", "System stopped.");
  renderAll();
}

function emergency() {
  if (!S.running) { createAlert("warn", "Start the system before running an emergency drill."); return; }
  S.emergency = 2;
  createAlert("crit", "EMERGENCY drill: fault injected, control process created with top priority.");
  addProcess("Emergency Control", 1, true, 4);
  readSensors();
}

$("btnStart").onclick = startSystem;
$("btnStop").onclick = stopSystem;
$("btnEmergency").onclick = emergency;
$("btnAdd").onclick = () => { const t = TEMPLATES[rand(0, 4)]; addProcess(t.name, rand(1, 10), !!t.lock); renderAll(); };
$("btnClean").onclick = () => { S.procs = S.procs.filter(p => p.state !== "COMPLETED" && p.state !== "STOPPED"); renderAll(); };
$("btnClearAlerts").onclick = () => { alerts.length = 0; S.unread = 0; renderAlerts(); };
$("alertFilter").onchange = renderAlerts;
$("algo").onchange = e => {
  S.algo = e.target.value;
  $("quantum").disabled = S.algo !== "rr";
  $("policyName").textContent = POLICY[S.algo];
  createAlert("info", "Scheduling policy changed to " + POLICY[S.algo] + ".");
};
$("quantum").onchange = e => { S.quantum = Math.min(6, Math.max(1, +e.target.value || 3)); };

/* ---------- timers ---------- */
setInterval(sensorCycle, 2500);        // sensor acquisition
setInterval(schedulerTick, TICK_MS);   // CPU scheduler
setInterval(() => {                    // clock + uptime
  $("clock").textContent = new Date().toLocaleTimeString();
  if (S.running) {
    const s = Math.floor((Date.now() - S.startedAt) / 1000);
    $("uptime").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
}, 1000);

renderAll(); renderAlerts();
