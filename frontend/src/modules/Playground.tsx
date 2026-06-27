import React, { useState, useEffect, useRef } from "react";
import { CodeViewer } from "../components/CodeViewer";
import { PlaybackControls } from "../components/PlaybackControls";
import { ControlFlowGraph } from "../components/ControlFlowGraph";
import { Terminal, Cpu, Info, Zap } from "lucide-react";

const DEFAULT_CODE = `# Paste Python, C++, Go, PHP or SQL code here:
def factorial(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

def main():
    num = 4
    fact = factorial(num)
    print(f"Fact is {fact}")

if __name__ == "__main__":
    main()
`;

export const Playground: React.FC = () => {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [loading, setLoading] = useState<boolean>(false);
  const [detectedLang, setDetectedLang] = useState<string>("python");
  const [complexity, setComplexity] = useState<any>({
    time_complexity: "O(N)",
    space_complexity: "O(1)",
    explanation: "Standard factorial iteration.",
    badge_color: "green"
  });
  const [steps, setSteps] = useState<any[]>([]);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(0.8);
  const [activeTab, setActiveTab] = useState<"cfg" | "vars" | "console">("cfg");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cfgGraphs, setCfgGraphs] = useState<Record<string, string>>({});

  const playTimerRef = useRef<any>(null);

  // Trigger compilation & capture trace on mount for default code
  useEffect(() => {
    handleCompile(DEFAULT_CODE);
  }, []);

  // Autoplay handler
  useEffect(() => {
    if (playing) {
      playTimerRef.current = setTimeout(() => {
        if (stepIdx < steps.length - 1) {
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
  }, [playing, stepIdx, steps.length, speed]);

  const handleCompile = async (codeToCompile: string) => {
    setLoading(true);
    setErrorMsg("");
    setPlaying(false);
    try {
      const response = await fetch("http://localhost:8000/api/playground/trace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: codeToCompile }),
      });

      if (!response.ok) {
        throw new Error("Tracing compilation failed.");
      }

      const data = await response.json();
      setDetectedLang(data.language);
      setComplexity(data.complexity);
      setSteps(data.steps);
      setCfgGraphs(data.cfg_graphs || {});
      setStepIdx(0);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while compiling.");
    } finally {
      setLoading(false);
    }
  };

  const currentStep = steps[stepIdx] || null;
  const activeLine = currentStep ? currentStep.line : 1;
  const prevLine = stepIdx > 0 && steps[stepIdx - 1] ? steps[stepIdx - 1].line : null;
  
  const activeScopeRaw = currentStep?.stack && currentStep.stack.length > 0
    ? currentStep.stack[currentStep.stack.length - 1]
    : "global";
  const activeScope = activeScopeRaw === "<module>" ? "global" : activeScopeRaw;

  // Variables table helper
  const renderVariablesTable = () => {
    if (!currentStep || !currentStep.locals || Object.keys(currentStep.locals).length === 0) {
      return (
        <div className="text-slate-500 text-xs italic py-4">
          No variables initialized in the current frame scope.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 font-semibold">
              <th className="pb-2 w-1/2">Variable</th>
              <th className="pb-2 w-1/2">Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(currentStep.locals).map(([name, val]: [string, any]) => (
              <tr key={name} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2.5 font-mono text-cyan-400 font-medium">{name}</td>
                <td className="py-2.5 font-mono text-emerald-400 font-bold">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Stack trace helper
  const renderCallStack = () => {
    if (!currentStep || !currentStep.stack || currentStep.stack.length === 0) {
      return (
        <div className="text-slate-500 text-xs italic py-4">
          Global scope context execution.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {currentStep.stack.slice().reverse().map((func: string, idx: number) => {
          const depth = currentStep.stack.length - idx - 1;
          return (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-purple-500/20 bg-purple-500/5 text-purple-400 font-mono text-xs font-bold"
            >
              <span>[{depth}] {func}()</span>
              <Cpu size={14} className="opacity-60" />
            </div>
          );
        })}
      </div>
    );
  };

  // Get complexity badge color
  const getComplexityColor = (color: string) => {
    switch (color) {
      case "red": return "#FF3366";
      case "yellow": return "#FFAA00";
      case "green": return "#00FF66";
      default: return "#00F0FF";
    }
  };

  const compColor = getComplexityColor(complexity?.badge_color);

  return (
    <div className="flex flex-col gap-6">
      {/* Introduction */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          💻 Multi-Language Code Playground
        </h1>
        <p className="text-slate-400 text-sm max-w-4xl">
          Paste your code block in <span className="text-cyan-400 font-semibold">Python, C++, Go, PHP, or SQL</span>. 
          The analyzer auto-detects language structure, calculates Big O complexity runtime rules, isolates CFG block branches to the active function scope, and traces variables step-by-step.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Source Code Panel (Left side) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              Source Code Editor
            </h2>
            {errorMsg && (
              <span className="text-xs text-rose-400 font-medium">Error Occurred</span>
            )}
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-80 p-4 rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-md text-slate-200 font-mono text-sm focus:outline-none focus:border-cyan-500/40 transition-all resize-none shadow-inner"
            placeholder="Type code here..."
          />

          <button
            onClick={() => handleCompile(code)}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-950/20 disabled:opacity-50"
          >
            {loading ? "Analyzing Execution Trace..." : "Compile & Capture Trace"}
          </button>

          {/* Console / STDOUT window */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Terminal size={14} className="text-emerald-400" />
              <span>Console Output (stdout)</span>
            </div>
            <pre className="w-full h-24 p-3 rounded-lg bg-black/60 border border-white/5 font-mono text-xs text-emerald-400 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
              {currentStep?.stdout || "No stdout output yet."}
            </pre>
          </div>
        </div>

        {/* Trace Visualizations Panel (Right side) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Detected Language Header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-lg shadow-sm">
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Detected Language:</span>
            <span className="px-2.5 py-0.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider">
              {detectedLang}
            </span>
          </div>

          {/* Playback Control Panel */}
          {steps.length > 0 && (
            <PlaybackControls
              stepIdx={stepIdx}
              totalSteps={steps.length}
              playing={playing}
              onPrev={() => setStepIdx(prev => Math.max(0, prev - 1))}
              onNext={() => setStepIdx(prev => Math.min(steps.length - 1, prev + 1))}
              onPlayToggle={() => setPlaying(!playing)}
              onReset={() => {
                setStepIdx(0);
                setPlaying(false);
              }}
              speed={speed}
              onSpeedChange={setSpeed}
              eventLabel={currentStep?.event}
            />
          )}

          {/* Complexity Card */}
          <div
            className="p-4 rounded-xl bg-white/[0.02] border border-white/10 shadow-lg transition-all"
            style={{ borderTop: `3px solid ${compColor}` }}
          >
            <div className="flex items-center justify-around mb-3">
              <div className="text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Time Complexity</span>
                <div className="text-xl font-bold font-mono mt-1" style={{ color: compColor }}>
                  {complexity?.time_complexity || "O(1)"}
                </div>
              </div>
              <div className="w-[1px] h-10 bg-white/5" />
              <div className="text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Space Complexity</span>
                <div className="text-xl font-bold font-mono text-purple-400 mt-1">
                  {complexity?.space_complexity || "O(1)"}
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-300 border-t border-white/5 pt-3 leading-relaxed flex gap-2">
              <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Analysis:</strong> {complexity?.explanation || "Constant sequential execution."}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 gap-2 mt-2">
            <button
              onClick={() => setActiveTab("cfg")}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all relative ${
                activeTab === "cfg" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Control Flow Graph
            </button>
            <button
              onClick={() => setActiveTab("vars")}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all relative ${
                activeTab === "vars" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Variables & Stack
            </button>
            <button
              onClick={() => setActiveTab("console")}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all relative ${
                activeTab === "console" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Execution View
            </button>
          </div>

          {/* Tab Contents */}
          <div className="min-h-[300px]">
            {activeTab === "cfg" && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-400" />
                  <span>Scope-Focused Flow Graph</span>
                </span>
                <ControlFlowGraph cfgGraphs={cfgGraphs} activeLine={activeLine} activeScope={activeScope} />
              </div>
            )}

            {activeTab === "vars" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Local Variable Inspector</span>
                  {renderVariablesTable()}
                </div>
                <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Call Stack Frames</span>
                  {renderCallStack()}
                </div>
              </div>
            )}

            {activeTab === "console" && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Code Gutter Tracing</span>
                <CodeViewer code={code} activeLineNo={activeLine} prevLineNo={prevLine} />
              </div>
            )}
          </div>

          {/* Crash Warning Dialog */}
          {currentStep?.status === "crash" && (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-sm leading-relaxed mt-2 flex flex-col gap-1.5 shadow-lg shadow-rose-950/10">
              <span className="font-bold flex items-center gap-2 text-rose-400 uppercase text-xs tracking-wider">
                💥 Program Exception Encountered
              </span>
              <p className="font-mono text-xs bg-black/40 p-2.5 rounded border border-rose-500/10">
                {currentStep.error || "Runtime Crash"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
