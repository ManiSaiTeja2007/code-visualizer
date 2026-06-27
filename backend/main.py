import traceback
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from engines.python_tracer import CodeTracer
from engines.language_detector import detect_language, get_all_languages
from engines.snippet_analyzer import analyze_complexity
from engines.sql_runner import execute_synthetic_sql
from engines.repo_analyzer import analyze_repository
from components.flow_renderer import FlowRenderer
from database import get_cached_trace, cache_trace

app = FastAPI(title="CodeVisualizer API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Models ────────────────────────────────────────────────────────────
class CodeInput(BaseModel):
    code: str

class RepoInput(BaseModel):
    path: str
    max_depth: Optional[int] = 8

# ─── Snippet Tracing ──────────────────────────────────────────────────────────
@app.post("/api/playground/trace")
def trace_code(payload: CodeInput):
    try:
        code      = payload.code
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()

        cached = get_cached_trace(code_hash)
        if cached:
            return cached

        lang       = detect_language(code)
        complexity = analyze_complexity(code, lang)

        tracer    = CodeTracer()
        steps     = tracer.run(code, language=lang)

        renderer  = FlowRenderer(code)
        cfg_graphs = renderer.generate_all_scopes_svg()

        cache_trace(code_hash, code, lang, complexity, steps, cfg_graphs)

        return {
            "language":   lang,
            "complexity": complexity,
            "steps":      steps,
            "cfg_graphs": cfg_graphs,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Tracing error: {str(e)}")

# ─── SQL Execution ────────────────────────────────────────────────────────────
@app.post("/api/sql/execute")
def execute_sql(payload: CodeInput):
    try:
        res = execute_synthetic_sql(payload.code)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["error"])
        return res
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")

# ─── Language Metadata ────────────────────────────────────────────────────────
@app.get("/api/languages")
def list_languages():
    """Return metadata for all supported languages (for frontend tabs)."""
    return {"languages": get_all_languages()}

# ─── Repository Analyzer (Phase 2) ────────────────────────────────────────────
@app.post("/api/repo/analyze")
def analyze_repo(payload: RepoInput):
    """
    Analyze a local folder: traverse all files, build dependency graph,
    extract class/function symbols, return D3-ready node+edge graph.

    This is the Phase 2 foundation — the frontend will render this as an
    interactive Three.js force graph (better than gitdiagram.com).
    """
    try:
        result = analyze_repository(payload.path)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Repo analysis error: {str(e)}")

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
