import React, { useState, useEffect, useRef } from "react";
import { Cpu, HardDrive, Grid3X3, Play, Pause, ChevronRight, RotateCcw } from "lucide-react";

interface AssemblyVisualizerProps { code: string; trigger: number; }

interface State8085 {
  A: number; B: number; C: number; D: number; E: number; H: number; L: number;
  SP: number; PC: number;
  Flags: { S: number; Z: number; AC: number; P: number; CY: number };
}

const INIT_STATE: State8085 = {
  A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0, SP: 0xFF, PC: 0,
  Flags: { S: 0, Z: 0, AC: 0, P: 0, CY: 0 },
};

const hex8  = (v: number) => `${(v & 0xFF).toString(16).toUpperCase().padStart(2, "0")}H`;
const bin8  = (v: number) => `${(v & 0xFF).toString(2).padStart(8, "0")}`;

// ─── LED Flag Component ────────────────────────────────────────────────────
const LED: React.FC<{ name: string; value: number; desc: string }> = ({ name, value, desc }) => (
  <div className={`asm-led ${value === 1 ? "on" : "off"}`} title={desc}>
    <div className="asm-led-dot" style={value === 1 ? { animation: "ledPulse 1.5s ease-in-out infinite" } : {}} />
    <div className="asm-led-name">{name}</div>
    <div className="asm-led-value">{value}</div>
  </div>
);

// ─── Register Cell Component ───────────────────────────────────────────────
const RegCell: React.FC<{ label: string; value: number; accent?: boolean; flash: boolean }> = ({ label, value, accent, flash }) => (
  <div className={`asm-register-cell ${flash ? "just-written" : ""}`} style={accent ? { borderColor: "rgba(99,102,241,0.4)" } : {}}>
    <div className="asm-reg-label">{label}</div>
    <div className="asm-reg-value" style={{ color: accent ? "var(--accent-indigo)" : "var(--text-primary)", fontSize: accent ? 22 : 15 }}>
      {hex8(value)}
    </div>
    <div className="asm-reg-bin">{bin8(value)}</div>
  </div>
);

export const AssemblyVisualizer: React.FC<AssemblyVisualizerProps> = ({ code, trigger }) => {
  const [reg, setReg]           = useState<State8085>(INIT_STATE);
  const [prevReg, setPrevReg]   = useState<State8085>(INIT_STATE);
  const [lineIdx, setLineIdx]   = useState(0);
  const [logs, setLogs]         = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pipelineCycle, setPipelineCycle] = useState(0);
  const [activeTab, setActiveTab] = useState<"registers" | "pipeline" | "memory">("registers");
  const [memory, setMemory]     = useState<number[]>(Array(256).fill(0));
  const timerRef = useRef<any>(null);

  const lines = code.split("\n")
    .map(l => l.split(";")[0].trim())
    .filter(l => l.length > 0 && !l.endsWith(":"));

  const parseVal = (s: string, reg: State8085): number => {
    const u = s.toUpperCase();
    if (u === "A") return reg.A; if (u === "B") return reg.B; if (u === "C") return reg.C;
    if (u === "D") return reg.D; if (u === "E") return reg.E; if (u === "H") return reg.H;
    if (u === "L") return reg.L;
    if (u.endsWith("H")) return parseInt(u.slice(0, -1), 16);
    return parseInt(s, 10) || 0;
  };

  const setDest = (dest: string, val: number, r: State8085): State8085 => {
    const n = { ...r, Flags: { ...r.Flags } };
    const v = val & 0xFF;
    if (dest === "A") n.A = v; else if (dest === "B") n.B = v; else if (dest === "C") n.C = v;
    else if (dest === "D") n.D = v; else if (dest === "E") n.E = v;
    else if (dest === "H") n.H = v; else if (dest === "L") n.L = v;
    return n;
  };

  const updateFlags = (result: number, n: State8085): State8085 => {
    const v = result & 0xFF;
    n.Flags.Z  = v === 0 ? 1 : 0;
    n.Flags.S  = (v & 0x80) ? 1 : 0;
    n.Flags.CY = result > 0xFF || result < 0 ? 1 : 0;
    n.Flags.P  = (v.toString(2).split("1").length - 1) % 2 === 0 ? 1 : 0;
    return n;
  };

  const stepInstruction = () => {
    if (lineIdx >= lines.length) {
      setLogs(p => [...p.filter(l => l !== "Execution reached end."), "Execution reached end."]);
      setIsPlaying(false);
      return;
    }
    const rawLine = lines[lineIdx];
    setPrevReg(reg);

    setReg(prev => {
      let next = { ...prev, Flags: { ...prev.Flags } };
      const tokens  = rawLine.split(/[\s,]+/).filter(Boolean);
      const opcode  = tokens[0].toUpperCase();
      const ops     = tokens.slice(1);
      let logMsg    = `[${lineIdx + 1}] ${rawLine}`;

      try {
        switch (opcode) {
          case "MVI": {
            const dest = ops[0].toUpperCase();
            const val  = parseVal(ops[1] ?? "0", next);
            next = setDest(dest, val, next);
            logMsg += ` → ${dest} ← ${hex8(val)}`;
            break;
          }
          case "MOV": {
            const dest = ops[0].toUpperCase();
            const src  = ops[1]?.toUpperCase() ?? "A";
            const val  = parseVal(src, next);
            next = setDest(dest, val, next);
            logMsg += ` → ${dest} ← ${src} (${hex8(val)})`;
            break;
          }
          case "ADD": {
            const srcVal = parseVal(ops[0] ?? "0", next);
            const result = next.A + srcVal;
            next = updateFlags(result, next);
            next.A = result & 0xFF;
            logMsg += ` → A = ${hex8(next.A)}, CY=${next.Flags.CY}`;
            break;
          }
          case "SUB": {
            const srcVal = parseVal(ops[0] ?? "0", next);
            const result = next.A - srcVal;
            next = updateFlags(result, next);
            next.A = result & 0xFF;
            logMsg += ` → A = ${hex8(next.A)}, CY=${next.Flags.CY}`;
            break;
          }
          case "INR": {
            const dest = ops[0].toUpperCase();
            const cur  = parseVal(dest, next);
            const val  = (cur + 1) & 0xFF;
            next = setDest(dest, val, next);
            next.Flags.Z = val === 0 ? 1 : 0;
            logMsg += ` → ${dest} = ${hex8(val)}`;
            break;
          }
          case "DCR": {
            const dest = ops[0].toUpperCase();
            const cur  = parseVal(dest, next);
            const val  = (cur - 1) & 0xFF;
            next = setDest(dest, val, next);
            next.Flags.Z = val === 0 ? 1 : 0;
            logMsg += ` → ${dest} = ${hex8(val)}`;
            break;
          }
          case "ANI": case "ANA": {
            const v = parseVal(ops[0] ?? "0", next);
            next.A = next.A & v;
            next = updateFlags(next.A, next);
            logMsg += ` → A = ${hex8(next.A)}`;
            break;
          }
          case "ORI": case "ORA": {
            const v = parseVal(ops[0] ?? "0", next);
            next.A = next.A | v;
            next = updateFlags(next.A, next);
            logMsg += ` → A = ${hex8(next.A)}`;
            break;
          }
          case "XRI": case "XRA": {
            const v = parseVal(ops[0] ?? "0", next);
            next.A = next.A ^ v;
            next = updateFlags(next.A, next);
            logMsg += ` → A = ${hex8(next.A)}`;
            break;
          }
          case "STA": {
            const addr = parseVal(ops[0] ?? "0", next) & 0xFF;
            setMemory(m => { const nm = [...m]; nm[addr] = next.A; return nm; });
            logMsg += ` → MEM[${hex8(addr)}] = ${hex8(next.A)}`;
            break;
          }
          case "LDA": {
            const addr = parseVal(ops[0] ?? "0", next) & 0xFF;
            next.A = memory[addr] ?? 0;
            logMsg += ` → A ← MEM[${hex8(addr)}] = ${hex8(next.A)}`;
            break;
          }
          case "HLT": {
            logMsg += " → HALT";
            setIsPlaying(false);
            break;
          }
          default:
            logMsg += ` → skipped (unrecognized: ${opcode})`;
        }
      } catch {
        logMsg += " → parse error";
      }

      setLogs(p => [...p, logMsg]);
      return next;
    });

    setLineIdx(p => p + 1);
    setPipelineCycle(p => p + 1);
  };

  useEffect(() => {
    if (trigger > 0) {
      setReg(INIT_STATE); setPrevReg(INIT_STATE);
      setLineIdx(0); setPipelineCycle(0);
      setMemory(Array(256).fill(0));
      setLogs([`Starting execution of ${lines.length} instructions…`]);
      setIsPlaying(true);
    }
  }, [trigger]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(stepInstruction, 850);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, lineIdx]);

  // Which registers changed since last step
  const changed = (key: keyof State8085): boolean => {
    if (key === "Flags") return false;
    return (reg[key] as number) !== (prevReg[key] as number);
  };

  const pipeStages = ["Fetch", "Decode", "Execute", "Memory", "Write-back"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px", height: "100%", overflow: "hidden" }}>

      {/* Header + controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(99,102,241,0.25)" }}>
            <Cpu size={16} style={{ color: "var(--accent-indigo)" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>8085 Assembly Engine</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              Line <strong style={{ color: "var(--accent-indigo)" }}>{Math.min(lineIdx, lines.length)}</strong> / {lines.length}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg-main)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
            {[{ id: "registers", icon: <Cpu size={11} />, label: "Registers" }, { id: "pipeline", icon: <HardDrive size={11} />, label: "Pipeline" }, { id: "memory", icon: <Grid3X3 size={11} />, label: "Memory" }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6,
                  border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                  fontSize: 11, fontWeight: 700, transition: "all 0.14s ease",
                  background: activeTab === t.id ? "var(--bg-card)" : "transparent",
                  color: activeTab === t.id ? "var(--accent-indigo)" : "var(--text-muted)",
                  boxShadow: activeTab === t.id ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Play / Step */}
          <button
            onClick={() => setIsPlaying(p => !p)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "var(--accent-indigo)", fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={stepInstruction}
            style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <ChevronRight size={13} /> Step
          </button>
          <button onClick={() => { setReg(INIT_STATE); setLineIdx(0); setPipelineCycle(0); setLogs([]); setIsPlaying(false); setMemory(Array(256).fill(0)); }}
            style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--accent-amber)", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 240px", gap: 14, minHeight: 0, overflow: "hidden" }}>

        {/* Left — Main viz */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>

          {activeTab === "registers" && (
            <>
              {/* Accumulator (large) */}
              <div className="panel-card" style={{ flexShrink: 0 }}>
                <div className="panel-label">
                  <Cpu size={11} style={{ color: "var(--accent-indigo)" }} />
                  Microprocessor Registers
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <RegCell label="A (Accumulator)" value={reg.A} accent flash={changed("A")} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <RegCell label="SP" value={reg.SP} flash={changed("SP")} />
                      <RegCell label="PC" value={reg.PC} flash={changed("PC")} />
                    </div>
                  </div>
                  <RegCell label="B" value={reg.B} flash={changed("B")} />
                  <RegCell label="C" value={reg.C} flash={changed("C")} />
                  <RegCell label="D" value={reg.D} flash={changed("D")} />
                  <RegCell label="E" value={reg.E} flash={changed("E")} />
                  <RegCell label="H" value={reg.H} flash={changed("H")} />
                  <RegCell label="L" value={reg.L} flash={changed("L")} />
                </div>
              </div>

              {/* Flags as LEDs */}
              <div className="panel-card" style={{ flexShrink: 0 }}>
                <div className="panel-label" style={{ marginBottom: 8 }}>
                  Flag Status Register
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <LED name="S"  value={reg.Flags.S}  desc="Sign: 1 if result is negative" />
                  <LED name="Z"  value={reg.Flags.Z}  desc="Zero: 1 if result is zero" />
                  <LED name="AC" value={reg.Flags.AC} desc="Auxiliary Carry: carry from bit 3 to bit 4" />
                  <LED name="P"  value={reg.Flags.P}  desc="Parity: 1 if even number of 1 bits" />
                  <LED name="CY" value={reg.Flags.CY} desc="Carry: 1 if overflow from bit 7" />
                </div>
              </div>
            </>
          )}

          {activeTab === "pipeline" && (
            <div className="panel-card" style={{ flex: 1 }}>
              <div className="panel-label">
                <HardDrive size={11} style={{ color: "var(--accent-cyan)" }} />
                Instruction Pipeline — Cycle {pipelineCycle}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 8 }}>
                {pipeStages.map((stage, idx) => {
                  const instrIdx = pipelineCycle - idx;
                  const instr    = instrIdx >= 0 && instrIdx < lines.length ? lines[instrIdx] : null;
                  const isActive = instrIdx === lineIdx - 1;
                  return (
                    <div key={stage} style={{
                      display: "flex", flexDirection: "column", gap: 6,
                      padding: "10px 8px", borderRadius: 8,
                      border: isActive ? "1.5px solid rgba(99,102,241,0.5)" : "1px solid var(--border)",
                      background: isActive ? "rgba(99,102,241,0.08)" : "var(--bg-card)",
                      transition: "all 0.2s ease",
                    }}>
                      <div style={{ fontSize: 8.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: isActive ? "var(--accent-indigo)" : "var(--text-muted)", textAlign: "center" }}>
                        {stage}
                      </div>
                      <div style={{
                        flex: 1, borderRadius: 5, padding: "6px 4px", minHeight: 40,
                        background: instr ? "var(--bg-code)" : "transparent",
                        border: instr ? "1px solid var(--border)" : "1px dashed var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                        color: isActive ? "var(--accent-cyan)" : "var(--text-muted)",
                        textAlign: "center", wordBreak: "break-all",
                      }}>
                        {instr ?? "—"}
                      </div>
                      {isActive && (
                        <div style={{ width: "100%", height: 2, borderRadius: 1, background: "var(--accent-indigo)", animation: "pulse 1.2s ease-in-out infinite" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "memory" && (
            <div className="panel-card" style={{ flex: 1 }}>
              <div className="panel-label">
                <Grid3X3 size={11} style={{ color: "var(--accent-amber)" }} />
                Memory Map (256 bytes)
              </div>
              <div className="asm-mem-grid" style={{ marginTop: 10 }}>
                {memory.map((v, addr) => (
                  <div
                    key={addr}
                    className={`asm-mem-cell ${v !== 0 ? "active" : ""}`}
                    title={`0x${addr.toString(16).toUpperCase().padStart(2, "0")}: ${hex8(v)}`}
                  >
                    {v !== 0 ? v.toString(16).toUpperCase().padStart(2, "0") : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Execution Log + current instruction */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          {/* Current instruction highlight */}
          <div className="panel-card" style={{ flexShrink: 0 }}>
            <div className="panel-label" style={{ marginBottom: 6 }}>Current Instruction</div>
            <div style={{ padding: "8px 10px", borderRadius: 6, background: "var(--bg-code)", border: "1px solid var(--border)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: lineIdx > 0 && lineIdx <= lines.length ? "var(--accent-cyan)" : "var(--text-muted)", minHeight: 36, display: "flex", alignItems: "center" }}>
              {lineIdx > 0 && lineIdx <= lines.length ? lines[lineIdx - 1] : "Awaiting…"}
            </div>
          </div>

          {/* Code listing */}
          <div className="panel-card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="panel-label" style={{ marginBottom: 6 }}>Program Listing</div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {lines.map((l, i) => {
                const isActive = i === lineIdx - 1;
                const isDone   = i < lineIdx - 1;
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "3px 6px", borderRadius: 4,
                    background: isActive ? "rgba(99,102,241,0.12)" : isDone ? "rgba(16,185,129,0.04)" : "transparent",
                    borderLeft: isActive ? "2px solid var(--accent-indigo)" : isDone ? "2px solid var(--accent-green)" : "2px solid transparent",
                    transition: "all 0.15s ease",
                  }}>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", minWidth: 18, textAlign: "right", fontFamily: "monospace" }}>{i + 1}</span>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: isActive ? "var(--accent-cyan)" : isDone ? "var(--text-muted)" : "var(--text-secondary)", fontWeight: isActive ? 700 : 400, flex: 1 }}>{l}</span>
                    {isActive && <span style={{ fontSize: 7, color: "var(--accent-indigo)", flexShrink: 0 }}>▶</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Execution Log */}
          <div className="panel-card" style={{ flexShrink: 0, maxHeight: 140, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="panel-label" style={{ marginBottom: 4 }}>Execution Log</div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {logs.length === 0 ? (
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>Awaiting…</div>
              ) : [...logs].reverse().slice(0, 20).map((l, i) => (
                <div key={i} style={{
                  fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace",
                  color: l.includes("Error") || l.includes("error") ? "var(--accent-red)" : l.includes("HALT") ? "var(--accent-amber)" : "var(--text-secondary)",
                  padding: "1px 0",
                }}>
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
