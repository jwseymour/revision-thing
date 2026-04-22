"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./StudyTimer.module.css";

/* ============================================================
   Study Timer — Colour-Based Pomodoro Widget
   
   Two modes based on cognitive load:
     • Light Review:  25 min work / 5 min rest
     • Deep Focus:    60 min work / 10 min rest
   
   Displays a colour ring instead of numbers.
   The ring smoothly transitions from a calm state to a warmer 
   "finish" state, with a stronger pulsing cue in the final 20%.
   ============================================================ */

type StudyMode = "short" | "long";
type Phase = "work" | "rest";

interface ModeConfig {
  label: string;
  shortLabel: string;
  workMinutes: number;
  restMinutes: number;
  meta: string;
}

const MODES: Record<StudyMode, ModeConfig> = {
  short: {
    label: "Light Review",
    shortLabel: "Light",
    workMinutes: 25,
    restMinutes: 5,
    meta: "25 / 5 min",
  },
  long: {
    label: "Deep Focus",
    shortLabel: "Deep",
    workMinutes: 60,
    restMinutes: 10,
    meta: "60 / 10 min",
  },
};

/* --- Colour helpers --- */

// Work phase: Calm teal → Warm amber → Hot orange at the end
// Work phase: Green -> Amber -> Red
const WORK_COLOURS = {
  start: { r: 123, g: 196, b: 127 }, // Green (--status-success)
  mid:   { r: 229, g: 168, b: 75 },  // Amber (--status-warning)
  end:   { r: 217, g: 122, b: 122 }, // Red (--status-danger)
};

// Rest phase: Calm blue
const REST_COLOURS = {
  start: { r: 122, g: 174, b: 212 }, // Cool blue (--status-info)
  mid:   { r: 122, g: 174, b: 212 },
  end:   { r: 122, g: 174, b: 212 },
};

function lerpColour(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  t: number
) {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}

function getPhaseColour(phase: Phase, progress: number) {
  const palette = phase === "work" ? WORK_COLOURS : REST_COLOURS;

  // progress: 0 = just started, 1 = about to finish
  if (progress < 0.5) {
    const t = progress / 0.5;
    return lerpColour(palette.start, palette.mid, t);
  } else {
    const t = (progress - 0.5) / 0.5;
    return lerpColour(palette.mid, palette.end, t);
  }
}


export function StudyTimer() {
  const [mode, setMode] = useState<StudyMode>("short");
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("work");
  const [cycleCount, setCycleCount] = useState(0);
  const [phaseSwitching, setPhaseSwitching] = useState(false);

  // Time tracking
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = MODES[mode];

  const startPhase = useCallback(
    (p: Phase) => {
      const minutes = p === "work" ? MODES[mode].workMinutes : MODES[mode].restMinutes;
      const total = minutes * 60;
      setPhase(p);
      setTotalSeconds(total);
      setRemainingSeconds(total);
    },
    [mode]
  );

  // Start the timer
  const handleStart = () => {
    setIsRunning(true);
    setCycleCount(0);
    startPhase("work");
  };

  // Stop the timer
  const handleStop = () => {
    setIsRunning(false);
    setPhase("work");
    setCycleCount(0);
    setTotalSeconds(0);
    setRemainingSeconds(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Tick logic
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Phase complete — switch
          setPhaseSwitching(true);
          setTimeout(() => setPhaseSwitching(false), 500);

          if (phase === "work") {
            // Transition to rest
            const restTotal = MODES[mode].restMinutes * 60;
            setPhase("rest");
            setTotalSeconds(restTotal);
            return restTotal;
          } else {
            // Transition to next work cycle
            setCycleCount((c) => c + 1);
            const workTotal = MODES[mode].workMinutes * 60;
            setPhase("work");
            setTotalSeconds(workTotal);
            return workTotal;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, phase, mode]);

  // --- Derived visual values ---
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
  const colour = getPhaseColour(phase, progress);
  const colourStr = `rgb(${colour.r}, ${colour.g}, ${colour.b})`;
  const glowStr = `rgba(${colour.r}, ${colour.g}, ${colour.b}, 0.25)`;
  const isNearEnd = progress > 0.8;



  return (
    <div className={styles.timerContainer}>
      <div className={styles.timerFlipContainer}>
        {/* ---- IDLE STATE ---- */}
        <div className={`${styles.modeSelector} ${isRunning ? styles.hiddenState : ""}`}>
          <div className={styles.modeOptions}>
            <button
              className={`${styles.modeButton} ${mode === "short" ? styles.modeButtonActive : ""}`}
              onClick={() => setMode("short")}
              id="timer-mode-short"
            >
              {MODES.short.shortLabel}
              <span className={styles.modeMeta}>{MODES.short.meta}</span>
            </button>
            <button
              className={`${styles.modeButton} ${mode === "long" ? styles.modeButtonActive : ""}`}
              onClick={() => setMode("long")}
              id="timer-mode-long"
            >
              {MODES.long.shortLabel}
              <span className={styles.modeMeta}>{MODES.long.meta}</span>
            </button>
          </div>
          <button
            className={styles.startButton}
            onClick={handleStart}
            id="timer-start"
          >
            Start Session
          </button>
        </div>

        {/* ---- RUNNING STATE ---- */}
        <div className={`${styles.activeTimer} ${!isRunning ? styles.hiddenState : phaseSwitching ? styles.phaseSwitching : ""}`}>
          <button
            className={`${styles.timerBlob} ${isNearEnd ? styles.pulsingBlob : ""}`}
            style={{
              backgroundColor: colourStr,
              ["--blob-glow" as string]: glowStr,
            }}
            onClick={handleStop}
            title="Stop Session"
          >
            <span className={styles.timerBlobPhaseIcon}>
              {phase === "work" ? "📖" : "☕"}
            </span>
            <span className={styles.timerBlobStopIcon}>■</span>
          </button>
        </div>
      </div>
    </div>
  );
}
