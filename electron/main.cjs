// main.cjs - Electron main process
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mqtt = require("mqtt");

let win = null;
let mqttClient = null;
let mqttConnected = false;

// topic -> refCount
const topicRefCounts = new Map();

// ✅ Change this in ONE place later if needed
const MQTT_URL = "mqtt://159.203.3.86:1883";

function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function ensureMqttClient() {
  if (mqttClient) return mqttClient;

  mqttClient = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    clean: true,
    clientId: `talkio_main_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });

  mqttClient.on("connect", () => {
    mqttConnected = true;
    console.log("[MAIN MQTT] connected:", MQTT_URL);
    sendToRenderer("mqtt:event", { type: "connect" });

    // re-subscribe any active topics after reconnect
    for (const topic of topicRefCounts.keys()) {
      mqttClient.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.error("[MAIN MQTT] resubscribe failed:", topic, err);
          sendToRenderer("mqtt:event", {
            type: "error",
            error: `resubscribe failed for ${topic}: ${err.message || err}`,
          });
          return;
        }
        console.log("[MAIN MQTT] resubscribed:", topic);
      });
    }
  });

  mqttClient.on("reconnect", () => {
    mqttConnected = false;
    console.warn("[MAIN MQTT] reconnecting...");
    sendToRenderer("mqtt:event", { type: "reconnect" });
  });

  mqttClient.on("close", () => {
    mqttConnected = false;
    console.warn("[MAIN MQTT] socket closed");
    sendToRenderer("mqtt:event", { type: "close" });
  });

  mqttClient.on("offline", () => {
    mqttConnected = false;
    console.warn("[MAIN MQTT] offline");
    sendToRenderer("mqtt:event", { type: "offline" });
  });

  mqttClient.on("end", () => {
    mqttConnected = false;
    console.warn("[MAIN MQTT] ended");
    sendToRenderer("mqtt:event", { type: "end" });
  });

  mqttClient.on("error", (err) => {
    mqttConnected = false;
    console.error("[MAIN MQTT] error:", err);
    sendToRenderer("mqtt:event", {
      type: "error",
      error: err?.message || String(err),
    });
  });

  mqttClient.on("message", (topic, payload) => {
    // payload is Buffer; send Uint8Array to renderer
    const bytes = Uint8Array.from(payload);
    sendToRenderer("mqtt:message", {
      topic,
      payload: bytes,
    });
  });

  return mqttClient;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  win.webContents.on("did-finish-load", () => {
    console.log("[MAIN] window loaded");
  });
}

// ---------- IPC: MQTT ----------

ipcMain.handle("mqtt:connect", async () => {
  const client = ensureMqttClient();

  if (mqttConnected) {
    return { ok: true, connected: true };
  }

  // wait briefly for connect
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { ok: true, connected: mqttConnected };
});

ipcMain.handle("mqtt:getState", async () => {
  return { ok: true, connected: mqttConnected };
});

ipcMain.handle("mqtt:publish", async (_event, args) => {
  const client = ensureMqttClient();
  const { topic, payload, options = {} } = args || {};

  if (!topic) {
    return { ok: false, error: "Missing topic" };
  }

  const buf =
    payload instanceof Uint8Array
      ? Buffer.from(payload)
      : payload instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(payload))
      : typeof payload === "string"
      ? payload
      : Buffer.from(payload || []);

  return await new Promise((resolve) => {
    client.publish(topic, buf, options, (err) => {
      if (err) {
        resolve({ ok: false, error: err.message || String(err) });
      } else {
        resolve({ ok: true });
      }
    });
  });
});

ipcMain.handle("mqtt:subscribe", async (_event, args) => {
  const client = ensureMqttClient();
  const { topic, options = { qos: 0 } } = args || {};

  if (!topic) {
    return { ok: false, error: "Missing topic" };
  }

  const prev = topicRefCounts.get(topic) || 0;
  topicRefCounts.set(topic, prev + 1);

  // only subscribe on broker once for first consumer
  if (prev > 0) {
    return { ok: true, reused: true };
  }

  return await new Promise((resolve) => {
    client.subscribe(topic, options, (err) => {
      if (err) {
        topicRefCounts.delete(topic);
        resolve({ ok: false, error: err.message || String(err) });
      } else {
        resolve({ ok: true });
      }
    });
  });
});

ipcMain.handle("mqtt:unsubscribe", async (_event, args) => {
  const client = ensureMqttClient();
  const { topic } = args || {};

  if (!topic) {
    return { ok: false, error: "Missing topic" };
  }

  const prev = topicRefCounts.get(topic) || 0;
  if (prev <= 1) {
    topicRefCounts.delete(topic);

    return await new Promise((resolve) => {
      client.unsubscribe(topic, (err) => {
        if (err) {
          resolve({ ok: false, error: err.message || String(err) });
        } else {
          resolve({ ok: true });
        }
      });
    });
  }

  topicRefCounts.set(topic, prev - 1);
  return { ok: true, decremented: true };
});

// ---------- App lifecycle ----------

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  try {
    if (mqttClient) {
      mqttClient.end(true);
      mqttClient = null;
      mqttConnected = false;
    }
  } catch {}

  if (process.platform !== "darwin") app.quit();
});