import traceback
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from engines.python_tracer import CodeTracer
from engines.language_detector import detect_language
from engines.snippet_analyzer import analyze_complexity
from components.flow_renderer import FlowRenderer
from components.sql_renderer import SQL_ORDER_STEPS, SQL_OPTIMIZATION_STEPS
from database import get_cached_trace, cache_trace

app = FastAPI(title="CodeVisualizer API", version="1.0.0")

# Enable CORS for the frontend Vite server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REQUEST MODELS ---
class CodeInput(BaseModel):
    code: str

# --- API ENDPOINTS ---

@app.post("/api/playground/trace")
def trace_code(payload: CodeInput):
    try:
        code = payload.code
        # Compute SHA256 hash of the code snippet for caching
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
        
        # Check SQLite database cache first
        cached = get_cached_trace(code_hash)
        if cached:
            return cached
            
        # Compile and trace if not cached
        lang = detect_language(code)
        complexity = analyze_complexity(code, lang)
        
        # Run execution tracer
        tracer = CodeTracer()
        steps = tracer.run(code, language=lang)
        
        # Pre-compile CFG graphs for all scopes inside the snippet
        renderer = FlowRenderer(code)
        cfg_graphs = renderer.generate_all_scopes_svg()
        
        # Cache results in the SQLite database
        cache_trace(code_hash, code, lang, complexity, steps, cfg_graphs)
        
        return {
            "language": lang,
            "complexity": complexity,
            "steps": steps,
            "cfg_graphs": cfg_graphs
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Tracing error: {str(e)}")

@app.get("/api/sql/pipeline")
def get_sql_pipeline():
    return {
        "steps": SQL_ORDER_STEPS
    }

@app.get("/api/sql/optimizer")
def get_sql_optimizer():
    return {
        "steps": SQL_OPTIMIZATION_STEPS
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
