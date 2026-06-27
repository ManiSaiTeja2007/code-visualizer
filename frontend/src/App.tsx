import { useState, lazy, Suspense } from "react";
import { Terminal, Cpu, Database, BarChart3, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";

// Code splitting using React.lazy for 50-100kb modular blocks
const Playground = lazy(() => import("./modules/Playground").then(m => ({ default: m.Playground })));
const CMemory = lazy(() => import("./modules/CMemory").then(m => ({ default: m.CMemory })));
const SQLExecution = lazy(() => import("./modules/SQLExecution").then(m => ({ default: m.SQLExecution })));
const SearchPerformance = lazy(() => import("./modules/SearchPerformance").then(m => ({ default: m.SearchPerformance })));

type ModuleType = "playground" | "memory" | "sql" | "performance";

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleType>("playground");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const modules = [
    {
      id: "playground" as ModuleType,
      name: "Multi-Language Playground",
      desc: "Autoplay trace & analyze Big O complexity.",
      icon: <Terminal className="w-5 h-5" />,
    },
    {
      id: "memory" as ModuleType,
      name: "C Memory & Core Dumper",
      desc: "Track stack frames & SIGSEGV faults.",
      icon: <Cpu className="w-5 h-5" />,
    },
    {
      id: "sql" as ModuleType,
      name: "SQL Pipeline Simulator",
      desc: "Step through relational query engines.",
      icon: <Database className="w-5 h-5" />,
    },
    {
      id: "performance" as ModuleType,
      name: "Search Performance Comparer",
      desc: "Linear vs. Binary search side-by-side.",
      icon: <BarChart3 className="w-5 h-5" />,
    },
  ];

  const renderActiveModule = () => {
    switch (activeModule) {
      case "playground":
        return <Playground />;
      case "memory":
        return <CMemory />;
      case "sql":
        return <SQLExecution />;
      case "performance":
        return <SearchPerformance />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-slate-200 bg-[#06060F] font-sans selection:bg-cyan-500/30 selection:text-white">
      {/* Background Decorative Mesh Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full filter blur-[140px] pointer-events-none" />

      {/* Sidebar for desktop */}
      <aside 
        className={`hidden md:flex flex-col shrink-0 bg-[#0B0B16]/90 backdrop-blur-xl border-r border-white/5 gap-6 min-h-screen transition-all duration-300 relative z-25 ${
          sidebarCollapsed ? "w-20 px-2 py-6" : "w-72 p-6"
        }`}
      >
        {/* Title & Toggle Button */}
        {!sidebarCollapsed ? (
          <div className="flex items-center justify-between gap-2 select-none">
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-extrabold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
                CodeVisualizer
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                3D Simulation Suite
              </span>
            </div>
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all duration-200"
              title="Collapse Sidebar"
            >
              <ChevronLeft size={15} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 select-none">
            <span className="text-lg font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              CV
            </span>
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all duration-200"
              title="Expand Sidebar"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        <hr className="border-white/5" />

        {/* Modules List */}
        <nav className="flex flex-col gap-1.5">
          {modules.map((m) => {
            const isActive = activeModule === m.id;
            
            if (sidebarCollapsed) {
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  className={`flex items-center justify-center p-3.5 rounded-xl border transition-all duration-200 group relative ${
                    isActive
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-950/20"
                      : "bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className={isActive ? "text-cyan-400" : "text-slate-400"}>
                    {m.icon}
                  </div>
                  <span className="sidebar-tooltip">{m.name}</span>
                </button>
              );
            }

            return (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                className={`flex items-start gap-4 p-3.5 rounded-xl border text-left transition-all duration-200 ${
                  isActive
                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-950/20"
                    : "bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/5 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className={`mt-0.5 shrink-0 ${isActive ? "text-cyan-400" : "text-slate-400"}`}>
                  {m.icon}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold leading-tight">{m.name}</span>
                  <span className="text-[10px] opacity-70 leading-normal font-medium">{m.desc}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer info inside sidebar */}
        <div className="mt-auto pt-4 text-[9px] text-slate-500 font-mono text-center border-t border-white/5 select-none">
          {!sidebarCollapsed ? "v1.1.0 • Stable Release" : "v1.1"}
        </div>
      </aside>

      {/* Header for mobile devices */}
      <header className="flex md:hidden items-center justify-between p-4 bg-[#0B0B16] border-b border-white/5 z-50">
        <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          CodeVisualizer
        </span>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[60px] bg-[#06060F]/95 backdrop-blur-xl z-40 p-6 flex flex-col gap-4 border-b border-white/5">
          <nav className="flex flex-col gap-2">
            {modules.map((m) => {
              const isActive = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveModule(m.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    isActive
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                      : "bg-transparent border-transparent text-slate-400"
                  }`}
                >
                  <div className={isActive ? "text-cyan-400" : "text-slate-500"}>
                    {m.icon}
                  </div>
                  <span className="text-sm font-semibold">{m.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Workspace with Suspense loading */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full relative z-10">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <div className="text-slate-400 font-mono text-xs">Loading simulator module...</div>
          </div>
        }>
          {renderActiveModule()}
        </Suspense>
      </main>
    </div>
  );
}
