import React from "react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

interface PlaybackControlsProps {
  stepIdx: number;
  totalSteps: number;
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPlayToggle: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  eventLabel?: string;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  stepIdx,
  totalSteps,
  playing,
  onPrev,
  onNext,
  onPlayToggle,
  onReset,
  speed,
  onSpeedChange,
  eventLabel = ""
}) => {
  return (
    <div className="flex flex-col gap-4 p-4 mb-4 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={stepIdx === 0}
            className="flex items-center justify-center p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/40 disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:border-white/10 transition-all"
            title="Step Back"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={onPlayToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-all ${
              playing
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
            }`}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            <span>{playing ? "Pause" : "Autoplay"}</span>
          </button>

          <button
            onClick={onNext}
            disabled={stepIdx === totalSteps - 1}
            className="flex items-center justify-center p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/40 disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:border-white/10 transition-all"
            title="Step Next"
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={onReset}
            className="flex items-center justify-center p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/40 text-amber-400 transition-all"
            title="Reset to Start"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* Speed Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Speed:</span>
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.1"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-28 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
          <span className="text-sm font-mono text-cyan-400 w-10 text-right">{speed.toFixed(1)}s</span>
        </div>

        {/* Step Indicator */}
        <div className="text-sm font-semibold text-slate-400">
          Step <span className="text-white font-mono">{stepIdx + 1}</span> of{" "}
          <span className="text-white font-mono">{totalSteps}</span>
          {eventLabel && (
            <span className="ml-2 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono uppercase text-purple-400">
              {eventLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
