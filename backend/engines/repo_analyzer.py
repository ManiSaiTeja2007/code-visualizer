"""
repo_analyzer.py — Repository-Level Static Analyzer

Phase 2 foundation: traverses a folder (or extracted zip), extracts:
  - File tree with language classification
  - Module dependency graph (imports → adjacency list)
  - Class/function hierarchy per file
  - Language breakdown statistics

This is the backend "engine" that the frontend Three.js graph will consume.
Designed to be replaced by a Rust implementation for performance on large repos.
"""

import os
import re
import ast
from pathlib import Path
from typing import Any
from collections import defaultdict

from engines.language_detector import detect_language_from_extension

# Files/dirs to always skip
IGNORED_DIRS  = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next", ".cache", "coverage"}
IGNORED_FILES = {".gitignore", ".prettierrc", ".eslintrc", "package-lock.json", "yarn.lock"}
MAX_FILE_SIZE_BYTES = 512 * 1024  # 512KB — skip huge generated files


# ─── Public API ───────────────────────────────────────────────────────────────

def analyze_repository(root_path: str) -> dict:
    """
    Main entry point. Given a folder path, returns a full analysis dict
    that the frontend can render as an interactive graph.
    """
    root = Path(root_path).resolve()
    if not root.is_dir():
        return {"error": f"Path '{root_path}' is not a directory."}

    # 1. Walk the tree
    file_tree   = _build_file_tree(root)
    all_files   = _flatten_files(file_tree)

    # 2. Language breakdown
    lang_counts: dict[str, int] = defaultdict(int)
    for f in all_files:
        lang_counts[f["language"]] += 1

    # 3. Build dependency graph
    dep_graph = _build_dependency_graph(all_files, root)

    # 4. Extract class/function hierarchy
    symbols = _extract_symbols(all_files)

    # 5. Build graph nodes + edges for frontend
    nodes, edges = _build_graph(all_files, dep_graph, root)

    return {
        "root": str(root),
        "file_count": len(all_files),
        "language_breakdown": dict(lang_counts),
        "file_tree": file_tree,
        "dependency_graph": dep_graph,
        "symbols": symbols,
        "graph": {
            "nodes": nodes,
            "edges": edges,
        },
        "stats": {
            "total_files": len(all_files),
            "total_dirs": _count_dirs(file_tree),
            "primary_language": max(lang_counts, key=lambda k: lang_counts[k]) if lang_counts else "unknown",
        }
    }


# ─── File Tree ────────────────────────────────────────────────────────────────

def _build_file_tree(path: Path, depth: int = 0, max_depth: int = 8) -> dict:
    """Recursively build file tree JSON."""
    if depth > max_depth:
        return {"name": path.name, "type": "dir", "truncated": True, "children": []}

    node: dict[str, Any] = {"name": path.name, "path": str(path)}

    if path.is_file():
        lang = detect_language_from_extension(path.name)
        size = path.stat().st_size
        node.update({"type": "file", "language": lang, "size": size})
    else:
        children = []
        try:
            entries = sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
            for entry in entries:
                if entry.name in IGNORED_DIRS or entry.name in IGNORED_FILES:
                    continue
                if entry.name.startswith("."):
                    continue
                children.append(_build_file_tree(entry, depth + 1, max_depth))
        except PermissionError:
            pass
        node.update({"type": "dir", "children": children})

    return node


def _flatten_files(tree: dict) -> list[dict]:
    """Flatten tree into list of file records."""
    result = []
    if tree.get("type") == "file":
        result.append(tree)
    for child in tree.get("children", []):
        result.extend(_flatten_files(child))
    return result


def _count_dirs(tree: dict) -> int:
    count = 1 if tree.get("type") == "dir" else 0
    for child in tree.get("children", []):
        count += _count_dirs(child)
    return count


# ─── Dependency Graph ────────────────────────────────────────────────────────

def _build_dependency_graph(files: list[dict], root: Path) -> dict[str, list[str]]:
    """
    Extract import/require/include statements per file.
    Returns adjacency list: { "path/file.py": ["path/other.py", ...] }
    """
    graph: dict[str, list[str]] = {}

    for f in files:
        fpath = Path(f["path"])
        lang  = f.get("language", "unknown")
        size  = f.get("size", 0)

        if size > MAX_FILE_SIZE_BYTES:
            continue

        try:
            content = fpath.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        deps: list[str] = []

        if lang == "python":
            deps = _extract_python_imports(content, fpath, root)
        elif lang in ("javascript", "typescript"):
            deps = _extract_js_imports(content, fpath, root)
        elif lang == "go":
            deps = _extract_go_imports(content)
        elif lang == "rust":
            deps = _extract_rust_imports(content)
        elif lang == "cpp":
            deps = _extract_cpp_includes(content)
        elif lang == "java":
            deps = _extract_java_imports(content)

        rel = str(fpath.relative_to(root))
        graph[rel] = list(dict.fromkeys(deps))  # deduplicate, preserve order

    return graph


def _extract_python_imports(content: str, fpath: Path, root: Path) -> list[str]:
    """Use AST to extract Python imports and resolve relative paths."""
    imports = []
    try:
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module.split(".")[0])
    except SyntaxError:
        # Fallback regex
        for m in re.finditer(r"^(?:from|import)\s+([\w.]+)", content, re.MULTILINE):
            imports.append(m.group(1).split(".")[0])
    return imports


def _extract_js_imports(content: str, fpath: Path, root: Path) -> list[str]:
    """Extract ES6 import and CommonJS require statements."""
    imports = []
    # import ... from 'module'
    for m in re.finditer(r"""(?:import\s+.*?from\s+|require\s*\(\s*)['"]([^'"]+)['"]""", content):
        imports.append(m.group(1))
    return imports


def _extract_go_imports(content: str) -> list[str]:
    """Extract Go import paths."""
    imports = []
    for m in re.finditer(r'"([^"]+)"', content):
        val = m.group(1)
        if "/" in val or "." in val:
            imports.append(val)
    return imports


def _extract_rust_imports(content: str) -> list[str]:
    """Extract Rust use statements."""
    imports = []
    for m in re.finditer(r"use\s+([\w:]+)", content):
        imports.append(m.group(1).split("::")[0])
    return imports


def _extract_cpp_includes(content: str) -> list[str]:
    """Extract C/C++ #include."""
    imports = []
    for m in re.finditer(r'#include\s*[<"]([^>"]+)[>"]', content):
        imports.append(m.group(1))
    return imports


def _extract_java_imports(content: str) -> list[str]:
    """Extract Java import statements."""
    imports = []
    for m in re.finditer(r"import\s+([\w.]+)\s*;", content):
        imports.append(m.group(1))
    return imports


# ─── Symbol Extraction ───────────────────────────────────────────────────────

def _extract_symbols(files: list[dict]) -> dict[str, dict]:
    """
    For each Python file, extract class/function names using AST.
    For other languages, use regex patterns.
    """
    result = {}
    for f in files:
        fpath = Path(f["path"])
        lang  = f.get("language", "unknown")
        if f.get("size", 0) > MAX_FILE_SIZE_BYTES:
            continue
        try:
            content = fpath.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        symbols: dict[str, list] = {"classes": [], "functions": []}

        if lang == "python":
            try:
                tree = ast.parse(content)
                for node in ast.walk(tree):
                    if isinstance(node, ast.ClassDef):
                        bases = [b.id if isinstance(b, ast.Name) else "" for b in node.bases]
                        symbols["classes"].append({"name": node.name, "line": node.lineno, "bases": bases})
                    elif isinstance(node, ast.FunctionDef):
                        symbols["functions"].append({"name": node.name, "line": node.lineno})
            except Exception:
                pass
        else:
            # Generic regex patterns for other languages
            for m in re.finditer(r"\bclass\s+([A-Z][a-zA-Z0-9_]*)", content):
                symbols["classes"].append({"name": m.group(1), "line": content[:m.start()].count("\n") + 1})
            for m in re.finditer(r"\b(?:def|func|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", content):
                symbols["functions"].append({"name": m.group(1), "line": content[:m.start()].count("\n") + 1})

        if symbols["classes"] or symbols["functions"]:
            rel = str(fpath.relative_to(fpath.parent.parent)) if fpath.parent != fpath.parent.parent else fpath.name
            result[rel] = symbols

    return result


# ─── Graph Builder ────────────────────────────────────────────────────────────

# Color palette per language for the force graph
LANG_COLORS = {
    "python":     "#facc15",
    "javascript": "#fde047",
    "typescript": "#67e8f9",
    "go":         "#67e8f9",
    "rust":       "#fb923c",
    "java":       "#fbbf24",
    "cpp":        "#60a5fa",
    "sql":        "#34d399",
    "assembly":   "#fb923c",
    "php":        "#a78bfa",
    "unknown":    "#6b7280",
}


def _build_graph(files: list[dict], dep_graph: dict, root: Path) -> tuple[list, list]:
    """Build node + edge arrays for the frontend D3/Three.js graph."""
    nodes = []
    edges = []
    file_id_map = {}

    for i, f in enumerate(files):
        fpath = Path(f["path"])
        rel   = str(fpath.relative_to(root))
        lang  = f.get("language", "unknown")
        file_id_map[rel] = i

        nodes.append({
            "id": i,
            "label": fpath.name,
            "path": rel,
            "language": lang,
            "color": LANG_COLORS.get(lang, "#6b7280"),
            "size": f.get("size", 0),
            "group": str(fpath.parent.relative_to(root)) if fpath.parent != root else ".",
        })

    for src, deps in dep_graph.items():
        src_id = file_id_map.get(src)
        if src_id is None:
            continue
        for dep in deps:
            # Try to resolve relative imports to actual files
            for rel, dst_id in file_id_map.items():
                if Path(rel).stem == dep or Path(rel).name.startswith(dep):
                    if src_id != dst_id:
                        edges.append({"source": src_id, "target": dst_id, "label": dep})
                    break

    return nodes, edges
