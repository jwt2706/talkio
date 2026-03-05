import React from "react";
import api from "./utils/api";
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from "./components/TalkButton";
import ExtendWindow from "./components/ExtendWindow";
import useFloorControl from "./hooks/useFloorControl";
import LoginPage from "./components/LoginPage";

import { usePttAudioTx } from "./audio/usePttAudioTx";
import { usePttAudioRx } from "./audio/usePttAudioRx";

// Admin portal overlay (inside the app, no router)
import AdminPortal from "./components/Adminportal";

const DEFAULT_CHANNELS = [
  { id: "1", name: "Channel 1" },
  { id: "2", name: "Channel 2" },
  { id: "3", name: "Channel 3" },
  { id: "4", name: "Channel 4" },
];

function makeSsrc32() {
  // Stable per app launch; good enough for hackathon
  // uint32
  const hi = (Math.random() * 0xffffffff) >>> 0;
  return hi;
}

function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // ✅ Fix: make channels stateful (so setChannels works)
  const [channels, setChannels] = React.useState(DEFAULT_CHANNELS);
  const [activeChannelId, setActiveChannelId] = React.useState(DEFAULT_CHANNELS[0].id);

  const [connectionStatus, setConnectionStatus] = React.useState("connecting"); // connecting | connected | error
  const [deviceStatus, setDeviceStatus] = React.useState(null);
  const [error, setError] = React.useState(null);

  // Admin portal open/close
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState(null);
  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const [users, setUsers] = React.useState([{ id: "u1", email: "user@uottawa.ca" }]);
  const [memberships, setMemberships] = React.useState({});

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // ✅ Unique talker id for RTP-like stream
  const mySsrc = React.useMemo(() => makeSsrc32(), []);

  // ✅ Floor control stays (independent from audio codec)
  const { status, requestMic, releaseMic, client } = useFloorControl(activeChannelId);

  // ✅ RX: always listen to RTP packets in this channel
  usePttAudioRx({
    mqttClient: client,
    channelId: activeChannelId,
  });

  // ✅ TX: only send when TALKING
  usePttAudioTx({
    mqttClient: client,
    channelId: activeChannelId,
    talking: status === "TALKING",
    ssrc: mySsrc,
  });

  // Connect to Skylink on mount with default creds
  React.useEffect(() => {
    let cancelled = false;
    async function connect() {
      setConnectionStatus("connecting");
      setError(null);
      try {
        await api.login("skytrac", "skytrac");
        if (cancelled) return;
        setConnectionStatus("connected");
      } catch (e) {
        if (cancelled) return;
        setConnectionStatus("error");
        setError("Failed to pair: " + (e.message || e.toString()));
      }
    }
    connect();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">
      {/* ✅ No <audio> element needed anymore (AudioWorklet outputs directly) */}

      {/* Header row */}
      <div className="w-full flex items-center justify-between px-4 pt-2">
        <div className="flex-shrink-0">
          <img
            src={connectionStatus === "connected" ? "/green-sat.png" : "/red-sat.png"}
            alt={connectionStatus === "connected" ? "Connected to Skylink" : "Not connected to Skylink"}
            className="w-14 h-14 drop-shadow"
          />
        </div>

        <h1 className="text-4xl font-bold drop-shadow-lg text-center flex-1">Talkio</h1>

        <div className="flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col gap-1">
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center mt-5">
        {/* Connection status */}
        <div className="mt-4">
          {connectionStatus === "connecting" && (
            <span className="text-blue-600">Status: Connecting...</span>
          )}
          {connectionStatus === "connected" && (
            <span className="text-green-600">Status: Paired</span>
          )}
          {connectionStatus === "error" && (
            <span className="text-red-600">Status: Disconnected</span>
          )}
        </div>

        <p className="text-sm text-black/60">
          <span className="font-semibold">{activeChannel?.name}</span>
        </p>

        {/* Device status */}
        {connectionStatus === "connected" && deviceStatus && (
          <div className="mt-4 p-4 bg-white/80 rounded shadow text-black">
            <div>
              <b>Temperature:</b> {deviceStatus.temperature}°C
            </div>
            <div>
              <b>Uptime:</b> {deviceStatus.uptime} s
            </div>
            <div>
              <b>CPU Usage:</b> {deviceStatus.cpuUsage}%
            </div>
            <div>
              <b>Memory Usage:</b> {deviceStatus.memoryUsage}%
            </div>
            <div>
              <b>Storage Usage:</b> {deviceStatus.storageUsage}%
            </div>
          </div>
        )}

        {connectionStatus === "error" && error && (
          <p className="mt-3 text-sm text-red-700">{error}</p>
        )}
      </div>

      <div className="w-full flex flex-col items-center gap-6 pb-12">
        <LiveWaveform running={status === "TALKING"} />
        <TalkButton status={status} onPress={requestMic} onRelease={releaseMic} />
      </div>

      <LoginPage open={!isLoggedIn} onLogin={handleLogin} />

      <ExtendWindow
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setDrawerOpen(false);
        }}
        onCreateChannel={(newChannel) => {
          setChannels((prev) => [...prev, newChannel]);
          setActiveChannelId(newChannel.id);
          setDrawerOpen(false);
        }}
      />

      <AdminPortal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        channels={channels}
        users={users}
        setUsers={setUsers}
        memberships={memberships}
        setMemberships={setMemberships}
      />
    </div>
  );
}

export default App;