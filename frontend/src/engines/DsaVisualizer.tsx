import React, { useState, useEffect, useRef } from "react";
import { CodeViewer } from "../components/CodeViewer";
import { ControlFlowGraph } from "../components/ControlFlowGraph";
import { Cpu, Info, Zap, AlertTriangle, Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

interface DsaVisualizerProps { code: string; language: string; trigger: number; }

// ─── Complexity Gauge ──────────────────────────────────────────────────────
const COMPLEXITY_LEVELS = [
  { label: "O(1)",     pct: 0.05, color: "#10b981" },
  { label: "O(log N)", pct: 0.18, color: "#34d399" },
  { label: "O(N)",     pct: 0.38, color: "#60a5fa" },
  { label: "O(N log N)", pct: 0.55, color: "#fbbf24" },
  { label: "O(N²)",   pct: 0.72, color: "#f97316" },
  { label: "O(N³)",   pct: 0.88, color: "#ef4444" },
  { label: "O(2ᴺ)",   pct: 1.0,  color: "#dc2626" },
];

function getGaugePct(tc: string): { pct: number; color: string } {
  const t = tc?.toLowerCase() ?? "";
  if (t.includes("2^") || t.includes("2ⁿ") || t.includes("2n")) return COMPLEXITY_LEVELS[6];
  if (t.includes("n^3") || t.includes("n³"))  return COMPLEXITY_LEVELS[5];
  if (t.includes("n^2") || t.includes("n²"))  return COMPLEXITY_LEVELS[4];
  if (t.includes("n log") || t.includes("nlogn")) return COMPLEXITY_LEVELS[3];
  if (t.includes("o(n)") || t.includes("linear")) return COMPLEXITY_LEVELS[2];
  if (t.includes("log")) return COMPLEXITY_LEVELS[1];
  return COMPLEXITY_LEVELS[0];
}

const ComplexityGauge: React.FC<{ timeComp: string; spaceComp: string }> = ({ timeComp, spaceComp }) => {
  const R = 52, stroke = 9;
  const circumference = Math.PI * R; // semi-circle
  const { pct, color } = getGaugePct(timeComp);
  const offset = circumference * (1 - pct);

  return (
    <div className="complexity-gauge-wrap">
      <svg width={130} height={80} viewBox="0 0 130 80" className="gauge-svg">
        {/* Track */}
        <path
          d={`M ${65 - R},65 A ${R},${R} 0 0 1 ${65 + R},65`}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${65 - R},65 A ${R},${R} 0 0 1 ${65 + R},65`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.85s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
        {/* Center label */}
        <text x="65" y="56" textAnchor="middle" className="gauge-label-time" fill={color} fontSize="13" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
          {timeComp || "O(1)"}
        </text>
        <text x="65" y="70" textAnchor="middle" className="gauge-label-name" fontSize="7.5" fontWeight="700" fill="var(--text-muted)" style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Time
        </text>
      </svg>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: -6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-purple)", fontFamily: "monospace" }}>Space: {spaceComp || "O(1)"}</span>
      </div>
    </div>
  );
};

// ─── Playback Controls ─────────────────────────────────────────────────────
const PlaybackBar: React.FC<{
  stepIdx: number; totalSteps: number; playing: boolean; speed: number; eventLabel?: string;
  onPrev: () => void; onNext: () => void; onToggle: () => void; onReset: () => void; onSpeed: (v: number) => void;
}> = ({ stepIdx, totalSteps, playing, speed, eventLabel, onPrev, onNext, onToggle, onReset, onSpeed }) => (
  <div className="playback-bar">
    <div className="playback-btns">
      <button className="pb-btn" onClick={onPrev} disabled={stepIdx === 0} title="Step Back">
        <ChevronLeft size={16} />
      </button>
      <button className={`pb-btn pb-btn-play ${playing ? "is-playing" : ""}`} onClick={onToggle}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
        <span>{playing ? "Pause" : "Play"}</span>
      </button>
      <button className="pb-btn" onClick={onNext} disabled={stepIdx >= totalSteps - 1} title="Step Next">
        <ChevronRight size={16} />
      </button>
      <button className="pb-btn" onClick={onReset} title="Reset" style={{ color: "var(--accent-amber)" }}>
        <RotateCcw size={14} />
      </button>
    </div>

    <div className="speed-ctrl">
      <span className="speed-label">Speed</span>
      <input type="range" className="speed-slider" min={0.2} max={2.0} step={0.1} value={speed}
        onChange={e => onSpeed(parseFloat(e.target.value))} />
      <span className="speed-val">{speed.toFixed(1)}s</span>
    </div>

    <div className="step-indicator">
      Step <span className="step-num">{totalSteps > 0 ? stepIdx + 1 : 0}</span> / <span className="step-num">{totalSteps}</span>
      {eventLabel && <span className="event-chip">{eventLabel}</span>}
    </div>
  </div>
);

// ─── Main DSA Visualizer ───────────────────────────────────────────────────
export const DsaVisualizer: React.FC<DsaVisualizerProps> = ({ code, trigger }) => {
  const [complexity, setComplexity] = useState<any>({ time_complexity: "O(1)", space_complexity: "O(1)", explanation: "Awaiting execution.", badge_color: "gray" });
  const [steps, setSteps]       = useState<any[]>([]);
  const [stepIdx, setStepIdx]   = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [speed, setSpeed]       = useState(0.8);
  const [activeTab, setActiveTab] = useState<"cfg" | "vars" | "code">("cfg");
  const [errorMsg, setErrorMsg] = useState("");
  const [cfgGraphs, setCfgGraphs] = useState<Record<string, string>>({});
  const timerRef = useRef<any>(null);

  useEffect(() => { if (trigger > 0) compile(code); }, [trigger]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setTimeout(() => {
        if (stepIdx < steps.length - 1) setStepIdx(p => p + 1);
        else setPlaying(false);
      }, speed * 1000);
    } else {
      clearTimeout(timerRef.current);
    }
    return () => clearTimeout(timerRef.current);
  }, [playing, stepIdx, steps.length, speed]);

  const compile = async (src: string) => {
    setErrorMsg(""); setPlaying(false);
    try {
      const res  = await fetch("http://localhost:8000/api/playground/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: src }),
      });
      if (!res.ok) throw new Error("Tracing failed.");
      const data = await res.json();
      setComplexity(data.complexity);
      setSteps(data.steps);
      setCfgGraphs(data.cfg_graphs ?? {});
      setStepIdx(0);
      setPlaying(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Compilation error.");
    }
  };

  const current    = steps[stepIdx] ?? null;
  const activeLine = current?.line ?? 1;
  const prevLine   = stepIdx > 0 ? steps[stepIdx - 1]?.line : null;
  const activeScope = (current?.stack?.slice(-1)[0] === "<module>" || !current?.stack?.length)
    ? "global"
    : (current?.stack?.slice(-1)[0] ?? "global");

  const vars  = current?.locals ?? {};
  const stack = current?.stack  ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px", height: "100%", overflow: "hidden" }}>

      {/* Error */}
      {errorMsg && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--accent-red)", fontSize: 12, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <AlertTriangle size={14} />
          {errorMsg}
        </div>
      )}

      {/* Playback Bar */}
      {!errorMsg && (
        <div style={{ flexShrink: 0 }}>
          <PlaybackBar
            stepIdx={stepIdx} totalSteps={steps.length} playing={playing} speed={speed}
            eventLabel={current?.event}
            onPrev={()  => setStepIdx(p => Math.max(0, p - 1))}
            onNext={()  => setStepIdx(p => Math.min(steps.length - 1, p + 1))}
            onToggle={() => setPlaying(p => !p)}
            onReset={()  => { setStepIdx(0); setPlaying(false); }}
            onSpeed={setSpeed}
          />
        </div>
      )}

      {/* Main Grid: Complexity/Console + Visualization */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, minHeight: 0, overflow: "hidden" }}>

        {/* Left column: gauge + console */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          
          {/* Complexity Gauge Card */}
          <div className="panel-card" style={{ flexShrink: 0 }}>
            <div className="panel-label">
              <Zap size={11} style={{ color: "var(--accent-amber)" }} />
              Complexity
            </div>
            <ComplexityGauge
              timeComp={complexity?.time_complexity ?? "O(1)"}
              spaceComp={complexity?.space_complexity ?? "O(1)"}
            />
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 10.5, color: "var(--text-secondary)", lineHeight: 1.5, display: "flex", gap: 6 }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: "var(--text-muted)" }} />
              <span>{complexity?.explanation ?? "Awaiting execution…"}</span>
            </div>
          </div>

          {/* Call Stack */}
          <div className="panel-card" style={{ flexShrink: 0 }}>
            <div className="panel-label">
              <Cpu size={11} style={{ color: "var(--accent-purple)" }} />
              Call Stack
            </div>
            {stack.length === 0 ? (
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontStyle: "italic" }}>Global scope.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[...stack].reverse().map((fn: string, i: number) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "5px 9px", borderRadius: 6,
                    border: "1px solid rgba(168,85,247,0.2)",
                    background: i === 0 ? "rgba(168,85,247,0.12)" : "rgba(168,85,247,0.05)",
                    fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                    color: i === 0 ? "var(--accent-purple)" : "var(--text-secondary)", fontWeight: 700,
                  }}>
                    <span>[{stack.length - i - 1}] {fn === "<module>" ? "global" : fn}()</span>
                    {i === 0 && <span style={{ fontSize: 8, opacity: 0.6 }}>▶ active</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stdout */}
          <div className="panel-card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="panel-label">
              <span style={{ color: "var(--accent-green)", fontWeight: 900 }}>❯</span>
              stdout
            </div>
            <pre style={{ flex: 1, overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--accent-green)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
              {current?.stdout || ""}
            </pre>
          </div>
        </div>

        {/* Right column: tabs + visualization */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            {[
              { id: "cfg",  label: "Control Flow",   icon: <Zap size={11} /> },
              { id: "vars", label: "Variables",      icon: <Info size={11} /> },
              { id: "code", label: "Code Tracer",    icon: <Cpu size={11} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid var(--accent-indigo)" : "2px solid transparent",
                  background: "transparent",
                  color: activeTab === tab.id ? "var(--accent-indigo)" : "var(--text-muted)",
                  fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.14s ease",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "auto", paddingTop: 12, minHeight: 0 }}>
            {activeTab === "cfg" && (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Zap size={11} style={{ color: "var(--accent-amber)" }} />
                  Scope-Focused CFG — <span style={{ color: "var(--text-primary)" }}>{activeScope}</span>
                </div>
                <div className="cfg-container" style={{ flex: 1 }}>
                  <ControlFlowGraph cfgGraphs={cfgGraphs} activeLine={activeLine} activeScope={activeScope} />
                </div>
              </div>
            )}

            {activeTab === "vars" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                <div>
                  <div className="panel-label" style={{ marginBottom: 8 }}>Local Variables</div>
                  {Object.keys(vars).length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>No variables in scope.</div>
                  ) : (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr><th>Variable</th><th>Value</th><th>Type</th></tr>
                        </thead>
                        <tbody>
                          {Object.entries(vars).map(([name, val]: [string, any]) => (
                            <tr key={name}>
                              <td style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{name}</td>
                              <td style={{ color: "var(--accent-green)", fontWeight: 700 }}>{String(val)}</td>
                              <td style={{ color: "var(--text-muted)", fontSize: 10 }}>
                                {Array.isArray(val) ? "list" : typeof val}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "code" && (
              <div style={{ height: "100%" }}>
                <div className="panel-label" style={{ marginBottom: 8 }}>Live Code Tracer</div>
                <CodeViewer code={code} activeLineNo={activeLine} prevLineNo={prevLine} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
