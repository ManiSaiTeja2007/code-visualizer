import React, { useState, useEffect, useRef } from "react";
import { Database, XCircle, Copy, Check, Table2, GitBranch, Activity } from "lucide-react";

interface SqlVisualizerProps { code: string; trigger: number; }

interface PipelineStep { phase: string; description: string; }

// Maps SQL phase names to icons and colors
const PHASE_META: Record<string, { icon: string; color: string; bg: string }> = {
  FROM:       { icon: "📂", color: "#06b6d4", bg: "rgba(6,182,212,0.10)"   },
  JOIN:       { icon: "🔗", color: "#a855f7", bg: "rgba(168,85,247,0.10)"  },
  WHERE:      { icon: "🔍", color: "#f59e0b", bg: "rgba(245,158,11,0.10)"  },
  "GROUP BY": { icon: "📊", color: "#10b981", bg: "rgba(16,185,129,0.10)"  },
  "ORDER BY": { icon: "🔃", color: "#60a5fa", bg: "rgba(96,165,250,0.10)"  },
  SELECT:     { icon: "✅", color: "#6366f1", bg: "rgba(99,102,241,0.10)"  },
  HAVING:     { icon: "📌", color: "#ec4899", bg: "rgba(236,72,153,0.10)"  },
};

// Classify column type for the badge
function getTypeClass(t: string): string {
  const type = (t || "").toLowerCase();
  if (type.includes("int") || type.includes("serial")) return "type-int";
  if (type.includes("text") || type.includes("varchar") || type.includes("char")) return "type-text";
  if (type.includes("decimal") || type.includes("float") || type.includes("numeric") || type.includes("real")) return "type-decimal";
  if (type.includes("date") || type.includes("time")) return "type-date";
  if (type.includes("bool")) return "type-bool";
  return "type-other";
}

// Copy to clipboard with visual feedback
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return { copied, copy };
}

export const SqlVisualizer: React.FC<SqlVisualizerProps> = ({ code, trigger }) => {
  const [logs, setLogs]               = useState<string[]>([]);
  const [results, setResults]         = useState<any[] | null>(null);
  const [mockDatabases, setMockDbs]   = useState<Record<string, any[]>>({});
  const [schema, setSchema]           = useState<Record<string, {name: string; type: string; pk: boolean}[]>>({});
  const [execPlan, setExecPlan]       = useState<PipelineStep[] | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [executing, setExecuting]     = useState(false);
  const [activeTab, setActiveTab]     = useState<"schema" | "data" | "results" | "logs">("schema");
  const { copied, copy }              = useCopyToClipboard();
  const logsRef                       = useRef<HTMLDivElement>(null);

  useEffect(() => { if (trigger > 0) runSql(code); }, [trigger]);
  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }, [logs]);

  const runSql = async (q: string) => {
    setExecuting(true); setError(null); setResults(null);
    setMockDbs({}); setExecPlan(null); setSchema({});
    setLogs([`> Sending script to SQL engine…`]);
    try {
      const res  = await fetch("http://localhost:8000/api/sql/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to execute SQL");

      setLogs(p => [...p, ...(data.logs ?? [])]);
      if (data.results)         setResults(data.results);
      if (data.mock_databases)  setMockDbs(data.mock_databases);
      if (data.execution_plan)  setExecPlan(data.execution_plan);
      if (data.schema)          setSchema(data.schema);

      // Build schema from mock_databases if backend didn't send schema explicitly
      if (!data.schema && data.mock_databases) {
        const built: Record<string, {name: string; type: string; pk: boolean}[]> = {};
        for (const [tbl, rows] of Object.entries(data.mock_databases as Record<string, any[]>)) {
          if (rows.length > 0) {
            built[tbl] = Object.keys(rows[0]).map((col, i) => ({
              name: col,
              type: typeof rows[0][col] === "number" ? "INTEGER" : "TEXT",
              pk: i === 0,
            }));
          }
        }
        setSchema(built);
      }

      // Auto-select tab based on what we got
      if (data.results && data.results.length > 0) setActiveTab("results");
      else if (Object.keys(data.mock_databases ?? {}).length > 0) setActiveTab("data");
    } catch (err: any) {
      setError(err.message);
      setLogs(p => [...p, `> ERROR: ${err.message}`]);
    } finally {
      setExecuting(false);
    }
  };

  const exportCsv = () => {
    if (!results || results.length === 0) return;
    const headers = Object.keys(results[0]).join(",");
    const rows    = results.map(r => Object.values(r).map(v => `"${v ?? ""}"`).join(",")).join("\n");
    copy(headers + "\n" + rows);
  };

  const tabs = [
    { id: "schema",  label: "Schema",  icon: <GitBranch size={11} />, count: Object.keys(schema).length },
    { id: "data",    label: "Mock Data",icon: <Table2 size={11} />,   count: Object.keys(mockDatabases).length },
    { id: "results", label: "Results", icon: <Activity size={11} />,  count: results?.length ?? null },
    { id: "logs",    label: "Logs",    icon: <Database size={11} />,  count: logs.length },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%", padding: "16px", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(99,102,241,0.25)" }}>
          <Database size={16} style={{ color: "var(--accent-indigo)" }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Synthetic SQL Engine</div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            Auto-generates realistic mock data · Animated query pipeline
          </div>
        </div>
        {executing && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--accent-amber)", fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-amber)", display: "inline-block", animation: "pulse 1s infinite" }} />
            Executing…
          </div>
        )}
      </div>

      {/* Execution Pipeline */}
      {execPlan && execPlan.length > 0 && (
        <div style={{ marginBottom: 14, flexShrink: 0 }}>
          <div className="panel-label">
            <Activity size={11} style={{ color: "var(--accent-cyan)" }} />
            SQL Execution Pipeline
          </div>
          <div className="sql-pipeline">
            {execPlan.map((step, idx) => {
              const meta = PHASE_META[step.phase] ?? { icon: "⚡", color: "var(--accent-cyan)", bg: "rgba(6,182,212,0.08)" };
              return (
                <React.Fragment key={idx}>
                  <div className="pipeline-step">
                    <div
                      className="pipeline-node"
                      style={{ background: meta.bg, borderColor: `${meta.color}44`, color: meta.color }}
                    >
                      <div className="pipeline-node-icon">{meta.icon}</div>
                      <div className="pipeline-node-name">{step.phase}</div>
                      <div className="pipeline-node-desc">{step.description}</div>
                    </div>
                  </div>
                  {idx < execPlan.length - 1 && (
                    <div className="pipeline-arrow">
                      <div className="pipeline-arrow-dot" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--accent-red)", fontSize: 12, fontFamily: "var(--font-mono)", marginBottom: 12, flexShrink: 0 }}>
          <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: 0, flexShrink: 0, marginBottom: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 14px", border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent-indigo)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab.id ? "var(--accent-indigo)" : "var(--text-muted)",
              fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 700,
              cursor: "pointer", transition: "all 0.14s ease",
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 900, padding: "1px 5px", borderRadius: 4,
                background: activeTab === tab.id ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)",
                color: activeTab === tab.id ? "var(--accent-indigo)" : "var(--text-muted)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}

        {/* Export button for results */}
        {activeTab === "results" && results && results.length > 0 && (
          <button
            onClick={exportCsv}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 5, background: "transparent", color: "var(--text-muted)", fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 600, cursor: "pointer", margin: "4px 0 4px auto" }}
          >
            {copied ? <Check size={11} style={{ color: "var(--accent-green)" }} /> : <Copy size={11} />}
            {copied ? "Copied!" : "Copy CSV"}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: "auto", paddingTop: 14, minHeight: 0 }}>

        {/* Schema Tab */}
        {activeTab === "schema" && (
          <div>
            {Object.keys(schema).length === 0 && !executing ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 10, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
                <Database size={32} style={{ opacity: 0.3 }} />
                <div style={{ fontWeight: 600 }}>No schema yet.</div>
                <div style={{ fontSize: 11 }}>Add <code style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>CREATE TABLE</code> statements and click Run.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                {Object.entries(schema).map(([tableName, cols]) => (
                  <div key={tableName} className="schema-card" style={{ animation: "fadeIn 0.3s ease" }}>
                    <div className="schema-card-header">
                      <Database size={12} />
                      {tableName}
                      <span className="schema-row-count">{(mockDatabases[tableName]?.length ?? 0)} rows</span>
                    </div>
                    {cols.map((col, i) => (
                      <div key={i} className="schema-col-row">
                        <span className="schema-col-name">
                          {col.pk && <span className="schema-col-pk">🔑 </span>}
                          {col.name}
                        </span>
                        <span className={`schema-type-chip ${getTypeClass(col.type)}`}>{col.type || "TEXT"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mock Data Tab */}
        {activeTab === "data" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {Object.keys(mockDatabases).length === 0 && !executing ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", fontSize: 12 }}>
                No mock data generated yet.
              </div>
            ) : (
              Object.entries(mockDatabases).map(([tbl, rows]) => (
                <div key={tbl}>
                  <div className="panel-label" style={{ marginBottom: 8 }}>
                    <Table2 size={11} style={{ color: "var(--accent-cyan)" }} />
                    {tbl}
                    <span style={{ marginLeft: "auto", fontSize: 9, background: "rgba(6,182,212,0.12)", color: "var(--accent-cyan)", padding: "1px 6px", borderRadius: 3, border: "1px solid rgba(6,182,212,0.2)" }}>
                      {rows.length} rows
                    </span>
                  </div>
                  {rows.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Empty table.</div>
                  ) : (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: 30 }}>#</th>
                            {Object.keys(rows[0]).map(k => <th key={k}>{k}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, idx) => (
                            <tr key={idx}>
                              <td className="td-row-no">{idx + 1}</td>
                              {Object.values(r).map((v: any, i) => (
                                <td key={i} className={v === null ? "td-null" : ""}>{v === null ? "NULL" : String(v)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Results Tab */}
        {activeTab === "results" && (
          <div>
            {executing ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: 12 }}>Executing Query…</div>
            ) : results === null ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: 12 }}>Awaiting execution…</div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: 12 }}>0 rows returned.</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="panel-label" style={{ marginBottom: 0 }}>
                    <Activity size={11} style={{ color: "var(--accent-green)" }} />
                    Query Results
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--accent-green)", fontWeight: 700, padding: "2px 8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 4 }}>
                    {results.length} row{results.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}>#</th>
                        {Object.keys(results[0]).map(k => <th key={k}>{k}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, idx) => (
                        <tr key={idx}>
                          <td className="td-row-no">{idx + 1}</td>
                          {Object.values(r).map((v: any, i) => (
                            <td key={i} className={v === null ? "td-null" : ""}>{v === null ? "NULL" : String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div ref={logsRef} style={{ padding: "10px 14px", borderRadius: 8, background: "var(--bg-code)", border: "1px solid var(--border)", minHeight: 120, maxHeight: "100%", overflowY: "auto", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7 }}>
            {logs.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>No logs yet.</span>
            ) : logs.map((l, i) => (
              <div key={i} style={{ color: l.includes("ERROR") ? "var(--accent-red)" : l.includes("Inserted") ? "var(--accent-green)" : "var(--text-secondary)" }}>
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
