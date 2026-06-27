import React, { useState, useEffect, useRef } from "react";
import { PlaybackControls } from "../components/PlaybackControls";
import { Terminal, Database, Zap, Info } from "lucide-react";

export const SQLExecution: React.FC = () => {
  const [selectedLesson, setSelectedLesson] = useState<string>("order");
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(0.8);
  
  const [pipelineSteps, setPipelineSteps] = useState<any[]>([]);
  const [optimizerSteps, setOptimizerSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const playTimerRef = useRef<any>(null);

  // Fetch SQL data on mount
  useEffect(() => {
    const fetchSqlData = async () => {
      setLoading(true);
      try {
        const pipeRes = await fetch("http://localhost:8000/api/sql/pipeline");
        const pipeData = await pipeRes.json();
        setPipelineSteps(pipeData.steps);

        const optRes = await fetch("http://localhost:8000/api/sql/optimizer");
        const optData = await optRes.json();
        setOptimizerSteps(optData.steps);
      } catch (err) {
        console.error("Failed to load SQL steps", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSqlData();
  }, []);

  // Reset index when switching lessons
  useEffect(() => {
    setStepIdx(0);
    setPlaying(false);
  }, [selectedLesson]);

  const steps = selectedLesson === "order" ? pipelineSteps : optimizerSteps;
  const currentStep = steps[stepIdx] || null;

  // Playback timer
  useEffect(() => {
    if (playing && steps.length > 0) {
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

  if (loading || steps.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-400">
        Loading SQL Database schemas...
      </div>
    );
  }

  // Phase highlight helper (FROM -> JOIN -> WHERE -> SELECT)
  const renderPhasePipeline = () => {
    if (selectedLesson !== "order" || !currentStep) return null;
    
    const phases = ["FROM", "JOIN / ON", "WHERE", "SELECT"];
    const activePhase = currentStep.phase;

    return (
      <div className="grid grid-cols-4 gap-3 mb-6">
        {phases.map((p) => {
          const isActive = p === activePhase;
          return (
            <div
              key={p}
              className={`flex items-center justify-center p-3 rounded-lg border font-semibold text-center text-xs transition-all ${
                isActive
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold scale-[1.02] shadow-md shadow-emerald-500/5 pulse-glowing"
                  : "bg-white/[0.01] border-white/5 text-slate-500"
              }`}
            >
              {p}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTable = (headers: string[], rows: any[], highlightIndices: number[] = []) => {
    return (
      <div className="overflow-x-auto rounded-lg border border-white/5 bg-slate-900/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 bg-white/[0.02]">
              {headers.map(h => (
                <th key={h} className="p-2.5 font-semibold capitalize">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isHighlighted = highlightIndices.includes(idx);
              return (
                <tr
                  key={idx}
                  className={`border-b border-white/5 transition-colors ${
                    isHighlighted ? "bg-white/10 text-white font-medium" : "hover:bg-white/[0.01] text-slate-300"
                  }`}
                >
                  {headers.map(h => (
                    <td key={h} className="p-2.5 font-mono">{row[h] !== undefined ? String(row[h]) : ""}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          🗄️ SQL Execution Order & Optimizer Pipeline
        </h1>
        <p className="text-slate-400 text-sm max-w-4xl">
          Observe how the relational database engine parses and compiles SQL instructions. 
          Step through order priorities (e.g. why `FROM` triggers before `SELECT`) and study optimization heuristics like Join Predicate Pushdown.
        </p>
      </div>

      {/* Selectors bar */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.01]">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select SQL Concept:</label>
        <select
          value={selectedLesson}
          onChange={(e) => setSelectedLesson(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/60 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/40"
        >
          <option value="order">1. Order of Execution (FROM → JOIN → WHERE → SELECT)</option>
          <option value="optimize">2. Join Predicate Pushdown (Join Optimization)</option>
        </select>
      </div>

      {/* Code viewer representation */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Terminal size={14} className="text-cyan-400" />
          <span>Active SQL Query Statement</span>
        </div>
        <pre className="p-4 rounded-xl border border-white/5 bg-slate-950/70 text-cyan-400 font-mono text-sm leading-relaxed overflow-x-auto shadow-inner">
          {selectedLesson === "order" ? (
            <code>
              <span className="text-purple-400">SELECT</span> users.name, orders.total{"\n"}
              <span className="text-purple-400">FROM</span> users{"\n"}
              <span className="text-purple-400">JOIN</span> orders <span className="text-purple-400">ON</span> users.user_id = orders.user_id{"\n"}
              <span className="text-purple-400">WHERE</span> orders.total &gt; <span className="text-emerald-400">100</span>
            </code>
          ) : (
            <code>
              <span className="text-slate-500">-- Query A (Slow): Joins users and orders, THEN filters USA</span>{"\n"}
              <span className="text-purple-400">SELECT</span> * <span className="text-purple-400">FROM</span> users <span className="text-purple-400">JOIN</span> orders <span className="text-purple-400">ON</span> users.user_id = orders.user_id <span className="text-purple-400">WHERE</span> users.country = <span className="text-emerald-400">'USA'</span>;{"\n\n"}
              <span className="text-slate-500">-- Query B (Fast): Filters USA users first, THEN joins orders (Predicate Pushdown)</span>{"\n"}
              <span className="text-purple-400">SELECT</span> * <span className="text-purple-400">FROM</span> (<span className="text-purple-400">SELECT</span> * <span className="text-purple-400">FROM</span> users <span className="text-purple-400">WHERE</span> country = <span className="text-emerald-400">'USA'</span>) u <span className="text-purple-400">JOIN</span> orders <span className="text-purple-400">ON</span> u.user_id = orders.user_id;
            </code>
          )}
        </pre>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Pipeline Details */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Info size={14} className="text-cyan-400" />
            <span>Execution step analysis</span>
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              {selectedLesson === "order" ? `Evaluating Phase: ${currentStep.phase}` : `Optimizer Step ${currentStep.step}`}
            </span>
            <p className="text-xs leading-relaxed text-slate-300 font-medium">
              {currentStep.description}
            </p>
          </div>
        </div>

        {/* Right Side: Playback and Data visual table */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Reusable Playback Controls */}
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
          />

          {renderPhasePipeline()}

          {/* Table display logic */}
          <div className="flex flex-col gap-6 w-full">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Database size={15} className="text-emerald-400" />
              <span>{currentStep.intermediate_title || "Intermediate Pipeline Results"}</span>
            </h3>

            {selectedLesson === "order" ? (
              // Order lesson layout
              currentStep.intermediate_data.users ? (
                // Step 1: RAW datasets side-by-side
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2 bg-[#0A0A16]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
                    <span className="text-xs font-semibold text-cyan-400">Table: users (Raw)</span>
                    {renderTable(
                      ["user_id", "name", "country"],
                      currentStep.intermediate_data.users,
                      currentStep.users_highlight
                    )}
                  </div>
                  <div className="flex flex-col gap-2 bg-[#0A0A16]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
                    <span className="text-xs font-semibold text-cyan-400">Table: orders (Raw)</span>
                    {renderTable(
                      ["order_id", "user_id", "total"],
                      currentStep.intermediate_data.orders,
                      currentStep.orders_highlight
                    )}
                  </div>
                </div>
              ) : (
                // Step 2, 3, 4: Single intermediate joined table
                <div className="flex flex-col gap-4">
                  {stepIdx === 1 && (
                    <div className="flex justify-center py-2">
                      <svg width="400" height="70" viewBox="0 0 400 70">
                        <path d="M 80 10 C 150 10, 150 60, 200 60 M 320 10 C 250 10, 250 60, 200 60" fill="none" stroke="#00FF66" strokeWidth="2" strokeDasharray="3,3"/>
                        <circle cx="200" cy="60" r="5" fill="#00FF66" />
                        <text x="200" y="35" fill="#E2E8F0" fontSize="11" fontWeight="bold" textAnchor="middle">JOIN ON users.user_id = orders.user_id</text>
                      </svg>
                    </div>
                  )}

                  {stepIdx === 2 && (
                    <div className="flex justify-center py-2">
                      <svg width="400" height="70" viewBox="0 0 400 70">
                        <path d="M 50 10 L 350 10 L 250 60 L 150 60 Z" fill="rgba(255, 51, 102, 0.1)" stroke="#FF3366" strokeWidth="1.5"/>
                        <text x="200" y="40" fill="#E2E8F0" fontSize="11" fontWeight="bold" textAnchor="middle">WHERE FILTER FUNNEL (total &gt; 100)</text>
                      </svg>
                    </div>
                  )}

                  {stepIdx === 3 && (
                    <div className="flex justify-center py-2">
                      <svg width="400" height="70" viewBox="0 0 400 70">
                        <line x1="200" y1="10" x2="200" y2="60" stroke="#00F0FF" strokeWidth="2" strokeDasharray="3,3"/>
                        <circle cx="200" cy="60" r="4" fill="#00F0FF" />
                        <text x="200" y="35" fill="#E2E8F0" fontSize="11" fontWeight="bold" textAnchor="middle" dx="20">SELECT COLUMNS PROJECTOR</text>
                      </svg>
                    </div>
                  )}

                  <div className="bg-[#0A0A16]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
                    {renderTable(
                      Object.keys(currentStep.intermediate_data[0] || {}),
                      currentStep.intermediate_data
                    )}
                  </div>
                </div>
              )
            ) : (
              // Optimization pushdown lesson side-by-side
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-[#0A0A16]/60 backdrop-blur-md">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">{currentStep.query_a_title}</span>
                  {typeof currentStep.query_a_data === "string" ? (
                    <div className="text-xs py-8 text-center text-rose-400/75 italic border border-rose-500/10 bg-rose-500/5 rounded-lg">
                      {currentStep.query_a_data}
                    </div>
                  ) : (
                    renderTable(
                      ["name", "order_id", "country", "total"],
                      currentStep.query_a_data
                    )
                  )}
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-[#0A0A16]/60 backdrop-blur-md">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap size={13} />
                    <span>{currentStep.query_b_title}</span>
                  </span>
                  {typeof currentStep.query_b_data === "string" ? (
                    <div className="text-xs py-8 text-center text-emerald-400/75 italic border border-emerald-500/10 bg-emerald-500/5 rounded-lg">
                      {currentStep.query_b_data}
                    </div>
                  ) : (
                    renderTable(
                      ["name", "order_id", "country", "total"],
                      currentStep.query_b_data
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
