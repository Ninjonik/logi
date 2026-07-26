"use client";

import { useEffect, useState } from "react";

import { PING_DURATION_MS, type PingShape } from "./types";

export function LivePingLayer({ pings }: { pings: PingShape[] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pings.length) {
      return;
    }

    let frameId = 0;
    const tick = () => {
      setNow(Date.now());
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [pings.length]);

  return (
    <>
      {pings
        .filter((ping) => now - new Date(ping.createdAt).getTime() < PING_DURATION_MS)
        .map((ping) => (
          <PingRipple key={ping.id} ping={ping} now={now} />
        ))}
    </>
  );
}

function PingRipple({ ping, now }: { ping: PingShape; now: number }) {
  const age = now - new Date(ping.createdAt).getTime();
  const progress = Math.min(1, Math.max(0, age / PING_DURATION_MS));

  return (
    <g>
      <circle cx={ping.x} cy={ping.y} r={6 + progress * 12} fill={ping.color} opacity={Math.max(0, 0.75 - progress * 0.75)} />
      {[
        { begin: 0, from: 10, to: 150, widthFrom: 10, widthTo: 2.5, opacityFrom: 0.95 },
        { begin: 70, from: 10, to: 185, widthFrom: 8, widthTo: 2, opacityFrom: 0.8 },
        { begin: 140, from: 10, to: 220, widthFrom: 6, widthTo: 1.5, opacityFrom: 0.65 },
      ].map((ring, index) => {
        const ringStart = ring.begin / PING_DURATION_MS;
        const ringProgress = Math.max(0, Math.min(1, (progress - ringStart) / (1 - ringStart)));
        if (ringProgress <= 0) {
          return null;
        }

        return (
          <circle
            key={index}
            cx={ping.x}
            cy={ping.y}
            r={ring.from + (ring.to - ring.from) * ringProgress}
            fill="none"
            stroke={ping.color}
            strokeWidth={ring.widthFrom + (ring.widthTo - ring.widthFrom) * ringProgress}
            opacity={Math.max(0, ring.opacityFrom - ringProgress * ring.opacityFrom)}
          />
        );
      })}
    </g>
  );
}
