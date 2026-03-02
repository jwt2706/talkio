import React from "react";
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from "./components/TalkButton";
import MobileStatusBarTopRight from "./components/MobileStatusBarTopRight";

function App() {
  const [waveformRunning, setWaveformRunning] = React.useState(false);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center">
      
      {/* Fixed top right status bar */}
      <MobileStatusBarTopRight />

      {/* Push content down so it doesn’t hide under status bar */}
      <div className="pt-16 w-full flex flex-col items-center flex-1">
        <h1 className="text-4xl font-bold mb-6 drop-shadow-lg mt-6">
          Talkio
        </h1>

        <div className="flex flex-col items-center gap-6 mt-10">
          <LiveWaveform running={waveformRunning} />

          <TalkButton
            onPress={() => setWaveformRunning(true)}
            onRelease={() => setWaveformRunning(false)}
          />
        </div>
      </div>
    </div>
  );
}

export default App;