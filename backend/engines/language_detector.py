import re

def detect_language(code_str: str) -> str:
    """
    Detects the programming language of a code snippet using keyword heuristics.
    Returns: 'python', 'cpp', 'go', 'php', 'sql', or 'python' (default fallback).
    """
    code_clean = code_str.strip()
    
    # 1. SQL Heuristics (Check common SQL verbs at start or scattered)
    sql_patterns = [
        r"^\s*(select|insert|update|delete|create|drop|alter)\b",
        r"\b(from|join|where|group by|having|order by|limit)\b"
    ]
    sql_score = sum(1 for p in sql_patterns if re.search(p, code_clean, re.IGNORECASE))
    if sql_score >= 2 or (re.search(r"^\s*(select|insert)\b", code_clean, re.IGNORECASE) and len(code_clean) < 200):
        return "sql"

    # 2. PHP Heuristics
    php_patterns = [
        r"<\?php",
        r"\?>",
        r"\$[a-zA-Z_][a-zA-Z0-9_]*\s*=",
        r"echo\s+['\"].*['\"]",
        r"\bforeach\s*\(\s*\$[a-zA-Z_].*\)",
        r"\binclude\s+['\"].*['\"]"
    ]
    php_score = sum(1 for p in php_patterns if re.search(p, code_clean))
    if php_score >= 2 or re.search(r"<\?php", code_clean):
        return "php"

    # 3. Go Heuristics
    go_patterns = [
        r"\bpackage\s+[a-zA-Z_]",
        r"\bfunc\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(",
        r"\bchan\s+[a-zA-Z_]",
        r"\bgo\s+func\(",
        r":=\s*",
        r"fmt\.Print"
    ]
    go_score = sum(1 for p in go_patterns if re.search(p, code_clean))
    # Extra check to ensure := doesn't misidentify python type hints or assignments
    if go_score >= 2 or re.search(r"\bpackage\s+main\b", code_clean):
        return "go"

    # 4. C/C++ Heuristics
    cpp_patterns = [
        r"#include\s*<[a-z_]+>",
        r"\busing\s+namespace\s+std\b",
        r"\bstd::cout\b",
        r"\bcout\s*<<\b",
        r"\bint\s+main\s*\(\s*\)",
        r"\bchar\s*\*\b",
        r"\bnullptr\b",
        r"\bclass\s+[a-zA-Z_].*\{"
    ]
    cpp_score = sum(1 for p in cpp_patterns if re.search(p, code_clean))
    if cpp_score >= 2 or re.search(r"#include\s*<[a-z_]+>", code_clean):
        return "cpp"

    # 5. Python Heuristics
    py_patterns = [
        r"\bdef\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(",
        r"\bimport\s+[a-zA-Z_]",
        r"\belif\s+.*:",
        r"\bself\.",
        r"\bif\s+__name__\s*==\s*['\"]__main__['\"]:",
        r"\bprint\s*\(.*\)",
        r"\bexcept\s+Exception\b"
    ]
    py_score = sum(1 for p in py_patterns if re.search(p, code_clean))
    if py_score >= 2:
        return "python"

    # Secondary fallback checking score densities
    scores = {
        "python": py_score,
        "cpp": cpp_score,
        "go": go_score,
        "php": php_score,
        "sql": sql_score
    }
    
    max_lang = max(scores, key=scores.get)
    if scores[max_lang] > 0:
        return max_lang

    return "python" # Default fallback
