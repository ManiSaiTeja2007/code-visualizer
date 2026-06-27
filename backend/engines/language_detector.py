import re

# ──────────────────────────────────────────────────────────────────────────────
# Language Detector — heuristics-based, no LLM required.
# Designed to be fast (<1ms) as a placeholder until Rust rewrite.
# ──────────────────────────────────────────────────────────────────────────────

LANGUAGE_METADATA = {
    "python":     {"label": "Python",     "color": "#facc15", "icon": "🐍", "ext": [".py"]},
    "cpp":        {"label": "C++",        "color": "#60a5fa", "icon": "⚙️", "ext": [".cpp", ".cc", ".cxx", ".h", ".hpp"]},
    "sql":        {"label": "SQL",        "color": "#34d399", "icon": "🗄️", "ext": [".sql"]},
    "assembly":   {"label": "Assembly",   "color": "#fb923c", "icon": "🔲", "ext": [".asm", ".s"]},
    "javascript": {"label": "JavaScript", "color": "#fde047", "icon": "🟨", "ext": [".js", ".mjs", ".cjs"]},
    "typescript": {"label": "TypeScript", "color": "#67e8f9", "icon": "🟦", "ext": [".ts", ".tsx"]},
    "go":         {"label": "Go",         "color": "#67e8f9", "icon": "🐹", "ext": [".go"]},
    "rust":       {"label": "Rust",       "color": "#fb923c", "icon": "🦀", "ext": [".rs"]},
    "java":       {"label": "Java",       "color": "#fbbf24", "icon": "☕", "ext": [".java"]},
    "php":        {"label": "PHP",        "color": "#a78bfa", "icon": "🐘", "ext": [".php"]},
}


def detect_language(code_str: str) -> str:
    """
    Detects the programming language of a code snippet via keyword heuristics.
    Returns one of: python, cpp, sql, assembly, javascript, typescript, go, rust, java, php.
    Fallback: python.
    """
    code_clean = code_str.strip()

    # 1. SQL — check verbs + clauses
    sql_patterns = [
        r"^\s*(select|insert|update|delete|create|drop|alter)\b",
        r"\b(from|join|where|group by|having|order by|limit)\b"
    ]
    sql_score = sum(1 for p in sql_patterns if re.search(p, code_clean, re.IGNORECASE))
    if sql_score >= 2 or re.search(r"^\s*(select|insert|create table)\b", code_clean, re.IGNORECASE):
        return "sql"

    # 2. Assembly — 8085/x86 opcodes
    asm_patterns = [r"^\s*(mvi|mov|add|sub|inr|dcr|jmp|push|pop|ldr|str|hlt|nop|ld|st|cmp|jnz|jz)\b"]
    if any(re.search(p, code_clean, re.IGNORECASE) for p in asm_patterns):
        return "assembly"

    # 3. PHP
    if re.search(r"<\?php", code_clean) or (
        sum(1 for p in [r"\$[a-zA-Z_]\w*\s*=", r"echo\s+", r"foreach\s*\("] if re.search(p, code_clean)) >= 2
    ):
        return "php"

    # 4. Go
    go_score = sum(1 for p in [
        r"\bpackage\s+[a-zA-Z_]", r"\bfunc\s+[a-zA-Z_]", r"\bchan\s+[a-zA-Z_]",
        r"\bgo\s+func\(", r"\bfmt\.Print", r":=\s*"
    ] if re.search(p, code_clean))
    if go_score >= 2 or re.search(r"\bpackage\s+main\b", code_clean):
        return "go"

    # 5. Rust
    rust_score = sum(1 for p in [
        r"\bfn\s+[a-zA-Z_]", r"\blet\s+mut\b", r"println!\s*\(", r"\buse\s+std::",
        r"\bimpl\s+[A-Z]", r"\b->.*\{", r"\bOption<", r"\bResult<"
    ] if re.search(p, code_clean))
    if rust_score >= 2:
        return "rust"

    # 6. Java
    java_score = sum(1 for p in [
        r"\bpublic\s+class\b", r"\bSystem\.out\.print", r"\bimport\s+java\.",
        r"\bpublic\s+static\s+void\s+main\b", r"\bnew\s+[A-Z][a-zA-Z]+\(",
        r"\b@Override\b"
    ] if re.search(p, code_clean))
    if java_score >= 2:
        return "java"

    # 7. TypeScript (superset of JS, check TS-specific syntax first)
    ts_score = sum(1 for p in [
        r":\s*(string|number|boolean|any|void|never)\b",
        r"\binterface\s+[A-Z]", r"\btype\s+[A-Z]\w*\s*=",
        r"\benum\s+[A-Z]", r"<[A-Z][a-zA-Z]*>"
    ] if re.search(p, code_clean))
    if ts_score >= 2:
        return "typescript"

    # 8. JavaScript
    js_score = sum(1 for p in [
        r"\bconsole\.log\b", r"\bconst\s+[a-zA-Z_]", r"\blet\s+[a-zA-Z_]",
        r"=>\s*[{(]?", r"\bfunction\s+[a-zA-Z_]", r"\brequire\s*\(",
        r"\bmodule\.exports\b", r"\bdocument\.", r"\bwindow\.", r"\bimport\s+.*from\b"
    ] if re.search(p, code_clean))
    if js_score >= 2:
        return "javascript"

    # 9. C/C++
    cpp_score = sum(1 for p in [
        r"#include\s*<[a-z_]+>", r"\busing\s+namespace\s+std\b",
        r"\bstd::cout\b", r"\bcout\s*<<", r"\bint\s+main\s*\(",
        r"\bchar\s*\*", r"\bnullptr\b", r"\bvoid\s+\w+\s*\(",
    ] if re.search(p, code_clean))
    if cpp_score >= 2 or re.search(r"#include\s*<[a-z_]+>", code_clean):
        return "cpp"

    # 10. Python
    py_score = sum(1 for p in [
        r"\bdef\s+[a-zA-Z_]\w*\s*\(", r"\bimport\s+[a-zA-Z_]",
        r"\belif\s+.*:", r"\bself\.", r"\bif\s+__name__\s*==",
        r"\bprint\s*\(", r"\bexcept\s+Exception\b", r"\blambda\b"
    ] if re.search(p, code_clean))
    if py_score >= 2:
        return "python"

    # Fallback — score-based winner
    scores = {
        "python": py_score, "cpp": cpp_score, "go": go_score,
        "php": 0, "rust": rust_score, "java": java_score,
        "javascript": js_score, "typescript": ts_score,
    }
    winner = max(scores, key=lambda k: scores[k])
    return winner if scores[winner] > 0 else "python"


def detect_language_from_extension(filename: str) -> str:
    """Detect language from file extension for repo traversal."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    for lang, meta in LANGUAGE_METADATA.items():
        if ext in meta["ext"]:
            return lang
    return "unknown"


def get_all_languages() -> dict:
    """Return metadata for all supported languages."""
    return LANGUAGE_METADATA
