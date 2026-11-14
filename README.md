# Ironline: Industrial Automation & Computing Framework

A browser-based simulation of an industrial monitoring system, built to demonstrate core Computer Architecture and Parallel Programming concepts: CPU scheduling, multi-core simulation, parallel processing with a Web Worker, synchronization with a mutex, and real-time monitoring.

Built with plain HTML, CSS and JavaScript. No frameworks, libraries or backend required.

> Course: Computer Architecture and Parallel Programming

---


## Features

- **Live sensor monitoring:** temperature, pressure, vibration and machine load, each with a live graph and warning and critical limit lines.
- **Four-core CPU simulation:** see which process is running on which core, tick by tick.
- **Three scheduling policies**, switchable while the system runs:
  - Priority scheduling with aging
  - Round Robin with an adjustable time quantum
  - First Come First Served (FCFS)
- **Gantt chart and ready queue** to compare how each policy behaves.
- **Process table** showing PID, priority, burst time, progress, state, core and waiting time.
- **Web Worker analysis:** sensor data is analysed on a separate thread, returning a risk level, health score and temperature trend.
- **Mutex-protected actuator:** control processes block each other to prevent conflicting commands.
- **Alert system** with filtering, an unread badge and an event log.
- **Emergency drill** that injects a fault so you can watch detection, alerting, priority scheduling and blocking in action.
- **Responsive navigation panel:** sidebar on desktop, bottom bar on mobile.

---

## Concepts Demonstrated

| Concept | Where it appears |
|---|---|
| Process management | `script.js` : `addProcess()`, process table |
| Thread (core) simulation | `script.js` : `S.cores`, `schedulerTick()` |
| CPU scheduling | `script.js` : `pickNext()` |
| Priority and aging | `script.js` : priority sort with waiting-time aging |
| Parallel processing | `worker.js` : Web Worker on a separate thread |
| Synchronization | `script.js` : `S.lock`, `dispatch()`, `release()` |
| Real-time monitoring | `script.js` : `stepSensors()`, `drawSpark()` |

---

## Project Structure

```
ironline/
├── index.html    # Page structure and navigation
├── style.css     # Styling and responsive layout
├── script.js     # Sensors, scheduler, processes, mutex, alerts, UI
├── worker.js     # Web Worker: risk level, health score, trend
└── README.md
```

---

## How to Run

The project uses a Web Worker, which browsers block when `index.html` is opened directly from disk. Run it through a local server instead.

**Option 1: VS Code Live Server**
1. Open the project folder in VS Code.
2. Install the *Live Server* extension.
3. Right-click `index.html` and choose **Open with Live Server**.

**Option 2: Python**
```bash
cd ironline
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

---

## How to Use

1. Click **Start** to bring the system online.
2. Watch the sensors update on the **Dashboard**.
3. Open the **Scheduler** page and switch the scheduling policy while processes are running. Compare the Gantt chart under each policy.
4. Open the **Processes** page to see every process and its state.
5. Click **Emergency drill** to inject a fault, then check the **Alerts** page.
6. Open the **Concepts** page to see where each topic is implemented in the code.
7. Click **Stop** to take the system offline.

---

## How It Works

**Sensors.** Each sensor drifts gradually towards a normal level with small random changes and occasional bumps, so the data looks like a real machine and not pure noise. Readings are sampled every 2.5 seconds.

**Scheduler.** The scheduler runs every 600 ms (one tick). Busy cores reduce the remaining time of their process by one, finished processes free their core, and idle cores pick the next process according to the selected policy.

**Worker.** After every reading, the main script sends the values to `worker.js` with `postMessage`. The worker checks them against the limits, subtracts from a health score of 100 (25 per critical value, 10 per warning value), detects the temperature trend, and replies. The main thread uses the echoed timestamp to measure the real round-trip time.

**Mutex.** Control processes need the actuator lock. If another process holds it, they are marked BLOCKED until it is released.

### Safety Limits

| Sensor | Warning | Critical |
|---|---|---|
| Temperature | 65 °C | 80 °C |
| Pressure | 7 bar | 9 bar |
| Vibration | 5 mm/s | 7 mm/s |
| Machine load | 75 % | 90 % |

---

## Technologies Used

- HTML5
- CSS3 (Grid, Flexbox, media queries)
- JavaScript (ES6+)
- Web Workers API
- Canvas API
- IBM Plex Sans and IBM Plex Mono (Google Fonts)

---

## Limitations

- All sensor data is simulated. There is no connection to real hardware.
- The four cores are simulated by the scheduler loop. Only the worker runs on a real separate thread.
- Context-switch time is not modelled.
- Data is kept in memory and resets when the page is reloaded.

---

## Future Improvements

- More algorithms: Shortest Job First, Shortest Remaining Time First, Multilevel Queue
- Average waiting time, turnaround time and throughput for each policy
- A pool of workers analysing sensors in parallel
- Deadlock demonstration with multiple shared resources
- Memory and cache simulation
- Real sensor input through a microcontroller
- Custom limits and downloadable reports

---


## License

This project was created for academic purposes. [Add a license here, for example MIT, or remove this section.]
