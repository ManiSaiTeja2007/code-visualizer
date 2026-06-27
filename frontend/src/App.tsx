import { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  Terminal, Play, Sun, Moon, Sparkles, ChevronRight,
  BookOpen, X, FolderOpen, Code2,
} from "lucide-react";
import { LanguageTabs } from "./components/LanguageTabs";
import type { Language } from "./components/LanguageTabs";

// Lazy-load visualization engines
const DsaVisualizer     = lazy(() => import("./engines/DsaVisualizer").then(m => ({ default: m.DsaVisualizer })));
const AssemblyVisualizer = lazy(() => import("./engines/AssemblyVisualizer").then(m => ({ default: m.AssemblyVisualizer })));
const SqlVisualizer     = lazy(() => import("./engines/SqlVisualizer").then(m => ({ default: m.SqlVisualizer })));

// ─── Example snippets per language ──────────────────────────────────────────
const EXAMPLES: Record<string, { label: string; code: string }[]> = {
  python: [
    {
      label: "Binary Search",
      code: `# Binary Search — O(log N)\ndef binary_search(arr, target):\n    low, high = 0, len(arr) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1\n\narr = [5, 12, 19, 23, 38, 45, 60, 72, 88, 95]\nbinary_search(arr, 23)\n`,
    },
    {
      label: "Fibonacci (Recursive)",
      code: `# Fibonacci — O(2^N) recursive\ndef fib(n):\n    if n <= 1:\n        return n\n    return fib(n - 1) + fib(n - 2)\n\nfib(6)\n`,
    },
    {
      label: "Bubble Sort",
      code: `# Bubble Sort — O(N^2)\ndef bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(0, n - i - 1):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr\n\nbubble_sort([64, 34, 25, 12, 22, 11, 90])\n`,
    },
  ],
  cpp: [
    {
      label: "Linked List",
      code: `#include <iostream>\nusing namespace std;\n\nstruct Node {\n    int data;\n    Node* next;\n    Node(int d) : data(d), next(nullptr) {}\n};\n\nvoid printList(Node* head) {\n    while (head != nullptr) {\n        cout << head->data << " ";\n        head = head->next;\n    }\n}\n\nint main() {\n    Node* head = new Node(1);\n    head->next = new Node(2);\n    head->next->next = new Node(3);\n    printList(head);\n    return 0;\n}\n`,
    },
  ],
  sql: [
    {
      label: "Employees Query",
      code: `CREATE TABLE departments (\n    dept_id INTEGER PRIMARY KEY,\n    name TEXT,\n    budget DECIMAL\n);\n\nCREATE TABLE employees (\n    id INTEGER PRIMARY KEY,\n    first_name TEXT,\n    last_name TEXT,\n    email TEXT,\n    salary DECIMAL,\n    dept_id INTEGER,\n    hire_date DATE\n);\n\nSELECT e.first_name, e.last_name, e.salary, d.name AS department\nFROM employees e\nJOIN departments d ON e.dept_id = d.dept_id\nWHERE e.salary > 60000\nORDER BY e.salary DESC;\n`,
    },
    {
      label: "Product Sales",
      code: `CREATE TABLE products (\n    id INTEGER PRIMARY KEY,\n    name TEXT,\n    price DECIMAL,\n    category TEXT\n);\n\nCREATE TABLE orders (\n    id INTEGER PRIMARY KEY,\n    product_id INTEGER,\n    quantity INTEGER,\n    order_date DATE\n);\n\nSELECT p.name, p.category, SUM(o.quantity) AS total_sold\nFROM products p\nJOIN orders o ON o.product_id = p.id\nGROUP BY p.id, p.name, p.category\nORDER BY total_sold DESC;\n`,
    },
  ],
  assembly: [
    {
      label: "Add Two Numbers",
      code: `; 8085 Assembly — Add B and C into A\nMVI B, 25H   ; Load 25H into B register\nMVI C, 15H   ; Load 15H into C register\nMOV A, B     ; Copy B to Accumulator\nADD C        ; A = A + C\nMOV D, A     ; Store result in D\n`,
    },
  ],
  javascript: [
    {
      label: "Quick Sort",
      code: `// Quick Sort — O(N log N) average\nfunction quickSort(arr) {\n    if (arr.length <= 1) return arr;\n    const pivot = arr[Math.floor(arr.length / 2)];\n    const left  = arr.filter(x => x < pivot);\n    const mid   = arr.filter(x => x === pivot);\n    const right = arr.filter(x => x > pivot);\n    return [...quickSort(left), ...mid, ...quickSort(right)];\n}\n\nconsole.log(quickSort([3, 6, 8, 10, 1, 2, 1]));\n`,
    },
  ],
  go: [
    {
      label: "Goroutine Fan-out",
      code: `package main\n\nimport (\n    "fmt"\n    "sync"\n)\n\nfunc worker(id int, wg *sync.WaitGroup) {\n    defer wg.Done()\n    fmt.Printf("Worker %d starting\\n", id)\n    // Simulate work\n    fmt.Printf("Worker %d done\\n", id)\n}\n\nfunc main() {\n    var wg sync.WaitGroup\n    for i := 1; i <= 5; i++ {\n        wg.Add(1)\n        go worker(i, &wg)\n    }\n    wg.Wait()\n}\n`,
    },
  ],
};

const DEFAULT_CODE = EXAMPLES.python[0].code;

// ─── Frontend language detector ──────────────────────────────────────────────
function detectLanguage(text: string): Language {
  const c = text.trim().toLowerCase();
  if (/^\s*(select|insert|update|create|drop)\b/.test(c) && /\b(from|join|where|table)\b/.test(c)) return "sql";
  if (/^\s*(mvi|mov|add|sub|jmp|push|pop|ldr|str)\b/.test(c)) return "assembly";
  if (c.includes("#include") || c.includes("std::") || c.includes("int main(")) return "cpp";
  if (/^\s*package\s+\w/.test(c) || c.includes("func main()") || c.includes(":= ")) return "go";
  if (c.includes("console.log") || /\bconst\s+\w/.test(c) || /=>/.test(c)) return "javascript";
  return "python";
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [code, setCode]                   = useState<string>(DEFAULT_CODE);
  const [selectedLang, setSelectedLang]   = useState<Language>("auto");
  const [detectedLang, setDetectedLang]   = useState<Language>("python");
  const [activeLang, setActiveLang]       = useState<Language>("python");
  const [isRunning, setIsRunning]         = useState(false);
  const [theme, setTheme]                 = useState<"light" | "dark">("dark");
  const [triggerCount, setTriggerCount]   = useState(0);
  const [showExamples, setShowExamples]   = useState(false);
  const [editorWidth, setEditorWidth]     = useState(38); // % of viewport
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Theme sync
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Live auto-detect as user types
  useEffect(() => {
    setDetectedLang(detectLanguage(code));
  }, [code]);

  const handleRunCode = () => {
    setIsRunning(true);
    const lang = selectedLang === "auto" ? detectLanguage(code) : selectedLang;
    setActiveLang(lang);
    setTriggerCount(prev => prev + 1);
    setTimeout(() => setIsRunning(false), 350);
  };

  // ── Resizable pane drag ──────────────────────────────────────────────────
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setEditorWidth(Math.max(22, Math.min(60, pct)));
    };
    const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Active visualization engine ──────────────────────────────────────────
  const renderEngine = () => {
    if (isRunning) return (
      <div className="engine-loading">
        <div className="engine-spinner" />
        <span className="engine-loading-text">Analyzing Execution…</span>
      </div>
    );
    switch (activeLang) {
      case "sql":        return <SqlVisualizer      code={code} trigger={triggerCount} />;
      case "assembly":   return <AssemblyVisualizer code={code} trigger={triggerCount} />;
      // JS / Go / Python / C++ all route to DSA tracer (Python backend)
      default:           return <DsaVisualizer      code={code} language={activeLang} trigger={triggerCount} />;
    }
  };

  const langExamples = EXAMPLES[selectedLang === "auto" ? detectedLang : selectedLang] ?? EXAMPLES.python;

  return (
    <div className="app-root" data-theme={theme}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-left">
          <Terminal size={18} className="header-logo-icon" />
          <span className="header-logo-text">Code<span className="header-logo-accent">Visualizer</span></span>
          <span className="header-badge">IDE Sandbox</span>
        </div>

        <div className="header-center">
          <LanguageTabs
            selected={selectedLang}
            detected={detectedLang}
            onChange={setSelectedLang}
          />
        </div>

        <div className="header-right">
          <button
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            className="btn-icon" title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-400" />}
          </button>
        </div>
      </header>

      {/* ── Workspace ──────────────────────────────────────────────────── */}
      <main className="app-workspace" ref={containerRef}>

        {/* Left — Code Editor */}
        <div className="editor-pane" style={{ width: `${editorWidth}%` }}>
          {/* Editor tab bar */}
          <div className="editor-tabbar">
            <div className="editor-file-tab">
              <Code2 size={11} className="tab-icon" />
              <span>main.{activeLang === "cpp" ? "cpp" : activeLang === "sql" ? "sql" : activeLang === "assembly" ? "asm" : activeLang === "javascript" ? "js" : activeLang === "go" ? "go" : "py"}</span>
              {activeLang !== "auto" && (
                <span className="lang-active-chip">{activeLang}</span>
              )}
            </div>
            <div className="editor-tabbar-actions">
              <button
                onClick={() => setShowExamples(v => !v)}
                className="btn-examples"
                title="Examples"
              >
                <BookOpen size={12} />
                <span>Examples</span>
                <ChevronRight size={10} className={`examples-chevron ${showExamples ? "open" : ""}`} />
              </button>
              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className="btn-run"
              >
                {isRunning ? <Sparkles size={13} className="animate-pulse" /> : <Play size={13} />}
                {isRunning ? "Visualizing…" : "Run"}
              </button>
            </div>
          </div>

          {/* Examples drawer */}
          {showExamples && (
            <div className="examples-drawer">
              <div className="examples-drawer-header">
                <span>Examples</span>
                <button onClick={() => setShowExamples(false)} className="btn-icon-sm"><X size={12} /></button>
              </div>
              <div className="examples-list">
                {langExamples.map((ex, i) => (
                  <button
                    key={i}
                    className="example-item"
                    onClick={() => { setCode(ex.code); setShowExamples(false); }}
                  >
                    <FolderOpen size={11} className="example-icon" />
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Code textarea */}
          <div className="editor-body">
            {/* Line numbers */}
            <div className="editor-gutter" aria-hidden="true">
              {code.split("\n").map((_, i) => (
                <div key={i} className="editor-line-no">{i + 1}</div>
              ))}
            </div>
            <textarea
              id="code-editor"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="editor-textarea"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="// Type your code here…"
              onKeyDown={e => {
                // Tab → insert 4 spaces
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const start = el.selectionStart;
                  const end   = el.selectionEnd;
                  const next  = code.substring(0, start) + "    " + code.substring(end);
                  setCode(next);
                  setTimeout(() => { el.selectionStart = el.selectionEnd = start + 4; }, 0);
                }
              }}
            />
          </div>

          {/* Editor footer status bar */}
          <div className="editor-statusbar">
            <span className="status-lines">{code.split("\n").length} lines</span>
            <span className="status-encoding">UTF-8</span>
            <span className="status-lang">{activeLang !== "auto" ? activeLang.toUpperCase() : "AUTO"}</span>
          </div>
        </div>

        {/* ── Drag Handle ───────────────────────────────────────────────── */}
        <div className="drag-handle" onMouseDown={onDragStart} title="Drag to resize">
          <div className="drag-handle-bar" />
        </div>

        {/* Right — Visualization Panel */}
        <div className="viz-pane">
          <div className="viz-pane-header">
            <span className="viz-pane-title">
              <Sparkles size={12} className="viz-title-icon" />
              Visualization Engine
            </span>
            <span className="viz-lang-pill">{activeLang.toUpperCase()}</span>
          </div>
          <div className="viz-pane-body">
            <Suspense fallback={
              <div className="engine-loading">
                <div className="engine-spinner" />
                <span className="engine-loading-text">Loading Engine…</span>
              </div>
            }>
              {renderEngine()}
            </Suspense>
          </div>
        </div>

      </main>
    </div>
  );
}
