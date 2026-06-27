import React, { useRef, useState, useEffect } from "react";

export type Language = "auto" | "python" | "cpp" | "sql" | "assembly" | "javascript" | "go";

interface LanguageTabsProps {
  selected: Language;
  detected: Language | null;
  onChange: (lang: Language) => void;
}

const LANGUAGES: { id: Language; label: string; icon: string; color: string; badge?: string }[] = [
  { id: "auto",       label: "Auto",       icon: "⚡", color: "#a78bfa" },
  { id: "python",     label: "Python",     icon: "🐍", color: "#facc15" },
  { id: "cpp",        label: "C++",        icon: "⚙️", color: "#60a5fa" },
  { id: "sql",        label: "SQL",        icon: "🗄️", color: "#34d399" },
  { id: "assembly",   label: "ASM",        icon: "🔲", color: "#fb923c" },
  { id: "javascript", label: "JS",         icon: "🟨", color: "#fde047", badge: "NEW" },
  { id: "go",         label: "Go",         icon: "🐹", color: "#67e8f9", badge: "NEW" },
];

const DETECTED_LABEL: Record<string, string> = {
  python: "Python",
  cpp: "C++",
  sql: "SQL",
  assembly: "ASM",
  javascript: "JS",
  go: "Go",
};

export const LanguageTabs: React.FC<LanguageTabsProps> = ({ selected, detected, onChange }) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Animate the sliding indicator under the active tab
  useEffect(() => {
    const idx = LANGUAGES.findIndex((l) => l.id === selected);
    const el = tabRefs.current[idx];
    if (el) {
      const parent = el.parentElement?.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      setIndicatorStyle({
        left: rect.left - (parent?.left ?? 0),
        width: rect.width,
      });
    }
  }, [selected]);

  const activeColor = LANGUAGES.find((l) => l.id === selected)?.color ?? "#a78bfa";

  return (
    <div className="lang-tabs-root">
      {/* Sliding indicator */}
      <div
        className="lang-tab-indicator"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          background: `${activeColor}22`,
          borderColor: `${activeColor}66`,
        }}
      />

      {LANGUAGES.map((lang, idx) => {
        const isActive = selected === lang.id;
        return (
          <button
            key={lang.id}
            ref={(el) => { tabRefs.current[idx] = el; }}
            onClick={() => onChange(lang.id)}
            className={`lang-tab ${isActive ? "lang-tab-active" : ""}`}
            style={isActive ? { color: lang.color } : {}}
            title={lang.label}
          >
            <span className="lang-tab-icon">{lang.icon}</span>
            <span className="lang-tab-label">{lang.label}</span>
            {lang.badge && (
              <span className="lang-tab-badge" style={{ color: lang.color, borderColor: `${lang.color}44` }}>
                {lang.badge}
              </span>
            )}
          </button>
        );
      })}

      {/* Auto-detect indicator */}
      {selected === "auto" && detected && detected !== "auto" && (
        <div className="lang-detect-badge">
          <span className="lang-detect-dot" />
          <span>Detected: <strong>{DETECTED_LABEL[detected] ?? detected}</strong></span>
        </div>
      )}
    </div>
  );
};
