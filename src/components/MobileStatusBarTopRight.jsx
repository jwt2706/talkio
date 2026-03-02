import React, { useEffect, useState } from "react";

function SignalIcon({ level = 4 }) {
  const bars = [1, 2, 3, 4];

  return (
    <div className="flex items-end gap-[2px]">
      {bars.map((b) => (
        <div
          key={b}
          className="w-[3px] rounded-sm"
          style={{
            height: `${b * 4}px`,
            backgroundColor:
              b <= level
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.35)",
          }}
        />
      ))}
    </div>
  );
}

function BatteryIcon({ pct = 80 }) {
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className="flex items-center gap-1">
      <div className="relative h-4 w-8 rounded border border-white">
        <div
          className="absolute left-0 top-0 h-full bg-white"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="h-2 w-1 bg-white rounded-sm" />
    </div>
  );
}

export default function MobileStatusBarTopRight() {
  const [time, setTime] = useState(new Date());
  const [network, setNetwork] = useState("WiFi"); // WiFi | LTE | 5G | SATCOM
  const [signalLevel, setSignalLevel] = useState(4);
  const [battery, setBattery] = useState(82);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = `${time.getHours()}:${String(
    time.getMinutes()
  ).padStart(2, "0")}`;

  return (
    <div className="fixed top-0 right-0 z-50 p-3">
      <div className="flex items-center gap-3 rounded-b-xl bg-black/85 px-4 py-2 text-white backdrop-blur-md shadow-lg text-sm">
        {/* Network Type */}
        <span className="text-xs font-semibold tracking-wide">
          {network}
        </span>

        {/* Signal Strength */}
        <SignalIcon level={signalLevel} />

        {/* Battery */}
        <BatteryIcon pct={battery} />

        {/* Time */}
        <span className="font-semibold">{formattedTime}</span>
      </div>
    </div>
  );
}