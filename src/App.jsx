import React from 'react';
import api from './utils/api';
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from './components/TalkButton';
import ExtendWindow from './components/ExtendWindow';
import useFloorControl from './hooks/useFloorControl';

const CHANNELS = [
  { id: "1", name: "Chanel 1"},
  { id: "2", name: "Chanel 2"},
  { id: "3", name: "Chanel 3"},
  { id: "4", name: "Chanel 4"},
];


function App() {
  const [waveformRunning, setWaveformRunning] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeChannelId, setActiveChannelId] = React.useState(CHANNELS[0].id);
  const [connectionStatus, setConnectionStatus] = React.useState('connecting'); // connecting | connected | error
  const [deviceStatus, setDeviceStatus] = React.useState(null);
  const [error, setError] = React.useState(null);

  const activeChannel = CHANNELS.find(c => c.id === activeChannelId);
  const { status, requestMic, releaseMic } = useFloorControl(activeChannelId);

  React.useEffect(() => {
    async function connectAndFetch() {
      setConnectionStatus('connecting');
      setError(null);
      try {
        // Try login (hardcoded for now, you can make this dynamic)
        await api.login('skytrac', 'skytrac');
        setConnectionStatus('connected');
        // Fetch device status
        const status = await api.getDeviceStatus();
        setDeviceStatus(status);
      } catch (e) {
        setConnectionStatus('error');
        setError(e.message || 'Connection failed');
      }
    }
    connectAndFetch();
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">

      <div className="flex-1 w-full flex flex-col items-center mt-5">
        <div className="w-full flex justify-between items-center px-6">
          <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">Talkio</h1>

          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col gap-1"
          >
            <span className="w-6 h-0.5 bg-black rounded"></span>
            <span className="w-6 h-0.5 bg-black rounded"></span>
            <span className="w-6 h-0.5 bg-black rounded"></span>
          </button>
        </div>

        <p className="text-sm text-black/60">
          <span className="font-semibold">{activeChannel?.name}</span>
        </p>

        {/* Connection status */}
        <div className="mt-4">
          {connectionStatus === 'connecting' && <span className="text-blue-600">Connecting to device...</span>}
          {connectionStatus === 'connected' && <span className="text-green-600">Connected!</span>}
          {connectionStatus === 'error' && <span className="text-red-600">Connection failed: {error}</span>}
        </div>

        {/* Device status */}
        {connectionStatus === 'connected' && deviceStatus && (
          <div className="mt-4 p-4 bg-white/80 rounded shadow text-black">
            <div><b>Temperature:</b> {deviceStatus.temperature}°C</div>
            <div><b>Uptime:</b> {deviceStatus.uptime} s</div>
            <div><b>CPU Usage:</b> {deviceStatus.cpuUsage}%</div>
            <div><b>Memory Usage:</b> {deviceStatus.memoryUsage}%</div>
            <div><b>Storage Usage:</b> {deviceStatus.storageUsage}%</div>
          </div>
        )}
      </div>
      
      <div className="w-full flex flex-col items-center gap-6 pb-12">
        <LiveWaveform running={status === 'TALKING'} />

        <TalkButton status={status} onPress={requestMic} onRelease={releaseMic} />
      </div>

      {/* Extend Window */}
      <ExtendWindow
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channels={CHANNELS}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setDrawerOpen(false);
          setWaveformRunning(false);
        }}
      />
    </div>
  );
}

export default App
