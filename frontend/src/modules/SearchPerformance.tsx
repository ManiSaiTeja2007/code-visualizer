import React, { useState, useEffect, useRef } from "react";
import { PlaybackControls } from "../components/PlaybackControls";
import { Info, CheckCircle2, AlertCircle } from "lucide-react";
import { calculateLinearSteps, calculateBinarySteps } from "../utils/search";

export const SearchPerformance: React.FC = () => {
  const [target, setTarget] = useState<number>(23);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(0.8);

  const playTimerRef = useRef<any>(null);

  const array = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];

  const linearSteps = calculateLinearSteps(array, target);
  const binarySteps = calculateBinarySteps(array, target);
  const maxSteps = Math.max(linearSteps.length, binarySteps.length);

  // Reset step counter on target change
  useEffect(() => {
    setStepIdx(0);
    setPlaying(false);
  }, [target]);

  // Autoplay loop
  useEffect(() => {
    if (playing) {
      playTimerRef.current = setTimeout(() => {
        if (stepIdx < maxSteps - 1) {
          setStepIdx(prev => prev + 1);
        } else {
          setPlaying(false);
        }
      }, speed * 1000);
    } else {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    }

    return () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    };
  }, [playing, stepIdx, maxSteps, speed]);

  const lStepIdx = Math.min(stepIdx, linearSteps.length - 1);
  const bStepIdx = Math.min(stepIdx, binarySteps.length - 1);

  const lStep = linearSteps[lStepIdx];
  const bStep = binarySteps[bStepIdx];

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          📊 Search Algorithm Performance Comparer
        </h1>
        <p className="text-slate-400 text-sm max-w-4xl">
          Compare side-by-side complexity benchmarks of <span className="text-rose-400 font-semibold">Linear Search (O(N))</span> vs{" "}
          <span className="text-emerald-400 font-semibold">Binary Search (O(log N))</span>. 
          Pick a target integer and step through the index check divisions below.
        </p>
      </div>

      {/* Settings Bar */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.01]">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Target Value:</label>
        <select
          value={target}
          onChange={(e) => setTarget(parseInt(e.target.value))}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/60 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/40 font-mono font-bold"
        >
          <option value="23">23</option>
          <option value="56">56</option>
          <option value="8">8</option>
          <option value="91">91</option>
        </select>
        <div className="text-xs text-slate-500 font-medium font-mono ml-4">
          Array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
        </div>
      </div>

      {/* Controls */}
      <PlaybackControls
        stepIdx={stepIdx}
        totalSteps={maxSteps}
        playing={playing}
        onPrev={() => setStepIdx(prev => Math.max(0, prev - 1))}
        onNext={() => setStepIdx(prev => Math.min(maxSteps - 1, prev + 1))}
        onPlayToggle={() => setPlaying(!playing)}
        onReset={() => {
          setStepIdx(0);
          setPlaying(false);
        }}
        speed={speed}
        onSpeedChange={setSpeed}
      />

      {/* Side by side columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linear Search Column */}
        <div className="p-6 rounded-xl border border-rose-500/10 bg-rose-500/[0.01] flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-base font-bold text-rose-400">Linear Search (O(N))</h2>
            <span className="px-2.5 py-0.5 rounded-full border border-rose-400/20 bg-rose-400/5 text-rose-400 text-xs font-semibold font-mono">
              Linear Cost
            </span>
          </div>

          {/* Array visualization */}
          <div className="perspective-3d flex flex-wrap gap-3 justify-center py-4">
            {array.map((val, idx) => {
              let bg = "bg-slate-950/40 border-white/5 text-slate-500";
              let transformStyle = { transform: "rotateX(20deg) rotateY(-10deg) translateZ(0px)" };
              
              if (lStep.checked.includes(idx)) {
                if (val === target) {
                  bg = "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold shadow-lg shadow-emerald-500/15";
                  transformStyle = { transform: "rotateX(15deg) rotateY(-8deg) translateZ(12px)" };
                } else {
                  bg = "bg-rose-500/10 border-rose-500/40 text-rose-400/80";
                  transformStyle = { transform: "rotateX(18deg) rotateY(-8deg) translateZ(2px)" };
                }
              } else if (idx === lStep.idx) {
                bg = "bg-slate-900 border-amber-500 text-amber-400 font-bold shadow-lg shadow-amber-500/20";
                transformStyle = { transform: "rotateX(12deg) rotateY(-5deg) translateZ(20px)" };
              }

              return (
                <div
                  key={idx}
                  style={transformStyle}
                  className={`w-11 h-11 flex items-center justify-center rounded-lg border font-mono text-sm transition-all duration-300 ease-out ${bg}`}
                >
                  {val}
                </div>
              );
            })}
          </div>

          {/* Info stats */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="p-3 rounded-lg border border-white/5 bg-slate-900/30 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Comparisons Done</span>
              <div className="text-2xl font-bold text-rose-400 font-mono mt-1">{lStepIdx + 1}</div>
            </div>
            <div className="p-3 rounded-lg border border-white/5 bg-slate-900/30 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Worst Case Cost</span>
              <div className="text-2xl font-bold text-slate-400 font-mono mt-1">10 checks</div>
            </div>
          </div>

          {/* Description status */}
          <div className="p-4 rounded-lg bg-black/30 border border-white/5 text-xs text-slate-300 leading-relaxed min-h-[70px] flex items-start gap-2.5">
            {lStep.found ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-rose-400/80 shrink-0 mt-0.5" />
            )}
            <div>
              {lStep.found ? (
                <span>
                  <strong>Target Found!</strong> Element matches target <code>{target}</code> at index <code>{lStep.idx}</code>.
                </span>
              ) : (
                <span>
                  Evaluating index <code>{lStep.idx}</code>: Value <code>{lStep.val}</code> does not match target. Continuing search...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Binary Search Column */}
        <div className="p-6 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.01] flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
              <span>Binary Search (O(log N))</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 text-emerald-400 text-xs font-semibold font-mono">
              Logarithmic Cost
            </span>
          </div>

          {/* Array visualization */}
          <div className="perspective-3d flex flex-wrap gap-3 justify-center py-4">
            {array.map((val, idx) => {
              let bg = "bg-slate-950/40 border-white/5 text-slate-600 opacity-30";
              let transformStyle = { transform: "rotateX(20deg) rotateY(-10deg) translateZ(-5px)" };
              
              const inInterval = idx >= bStep.low && idx <= bStep.high;
              
              if (inInterval) {
                bg = "bg-slate-900/60 border-white/10 text-slate-300";
                transformStyle = { transform: "rotateX(20deg) rotateY(-10deg) translateZ(4px)" };
              }
              
              if (idx === bStep.mid) {
                if (val === target) {
                  bg = "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold shadow-lg shadow-emerald-500/15";
                  transformStyle = { transform: "rotateX(15deg) rotateY(-8deg) translateZ(12px)" };
                } else {
                  bg = "bg-amber-500/15 border-amber-500/50 text-amber-400 font-bold shadow-lg shadow-amber-500/20";
                  transformStyle = { transform: "rotateX(12deg) rotateY(-5deg) translateZ(20px)" };
                }
              }

              return (
                <div
                  key={idx}
                  style={transformStyle}
                  className={`w-11 h-11 flex items-center justify-center rounded-lg border font-mono text-sm transition-all duration-300 ease-out ${bg}`}
                >
                  {val}
                </div>
              );
            })}
          </div>

          {/* Info stats */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="p-3 rounded-lg border border-white/5 bg-slate-900/30 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Comparisons Done</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{bStepIdx + 1}</div>
            </div>
            <div className="p-3 rounded-lg border border-white/5 bg-slate-900/30 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Worst Case Cost</span>
              <div className="text-2xl font-bold text-slate-400 font-mono mt-1">4 checks</div>
            </div>
          </div>

          {/* Description status */}
          <div className="p-4 rounded-lg bg-black/30 border border-white/5 text-xs text-slate-300 leading-relaxed min-h-[70px] flex items-start gap-2.5">
            {bStep.found ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            )}
            <div>
              {bStep.found ? (
                <span>
                  <strong>Target Found!</strong> Element matches target <code>{target}</code> at middle index <code>{bStep.mid}</code>.
                </span>
              ) : (
                <span>
                  Inspected mid index <code>{bStep.mid}</code>: Value <code>{bStep.val}</code>. 
                  Target <code>{target}</code> is {target > bStep.val ? "larger" : "smaller"}, cutting search space in half 
                  (Low=<code>{bStep.low}</code>, High=<code>{bStep.high}</code>).
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
