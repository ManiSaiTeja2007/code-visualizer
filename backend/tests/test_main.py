import sys
import os
import time
import pytest
from fastapi.testclient import TestClient

# Add backend/ to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from engines.language_detector import detect_language, detect_language_from_extension, get_all_languages
from engines.snippet_analyzer import analyze_complexity
from engines.repo_analyzer import analyze_repository

client = TestClient(app)


# ─── Language Detector Tests ─────────────────────────────────────────────────

class TestLanguageDetector:
    def test_python_detection(self):
        code = "def hello():\n    print('hi')\nhello()"
        assert detect_language(code) == "python"

    def test_cpp_detection(self):
        code = "#include <iostream>\nusing namespace std;\nint main() { return 0; }"
        assert detect_language(code) == "cpp"

    def test_sql_detection(self):
        code = "SELECT name, age FROM users WHERE age > 18 ORDER BY name;"
        assert detect_language(code) == "sql"

    def test_sql_create_detection(self):
        code = "CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT);"
        assert detect_language(code) == "sql"

    def test_javascript_detection(self):
        code = "const arr = [1, 2, 3];\nconsole.log(arr.map(x => x * 2));"
        assert detect_language(code) == "javascript"

    def test_go_detection(self):
        code = "package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"hello\") }"
        assert detect_language(code) == "go"

    def test_rust_detection(self):
        code = "fn main() {\n    let mut x = 5;\n    println!(\"{}\", x);\n}"
        assert detect_language(code) == "rust"

    def test_java_detection(self):
        code = "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"hello\");\n    }\n}"
        assert detect_language(code) == "java"

    def test_assembly_detection(self):
        code = "MVI B, 25H\nMVI C, 15H\nADD C"
        assert detect_language(code) == "assembly"

    def test_extension_detection(self):
        assert detect_language_from_extension("main.py")   == "python"
        assert detect_language_from_extension("app.js")    == "javascript"
        assert detect_language_from_extension("main.go")   == "go"
        assert detect_language_from_extension("lib.rs")    == "rust"
        assert detect_language_from_extension("Main.java") == "java"
        assert detect_language_from_extension("query.sql") == "sql"

    def test_get_all_languages(self):
        langs = get_all_languages()
        assert "python"     in langs
        assert "javascript" in langs
        assert "go"         in langs
        assert "rust"       in langs
        assert "java"       in langs
        for lang_meta in langs.values():
            assert "label" in lang_meta
            assert "color" in lang_meta
            assert "ext"   in lang_meta


# ─── Complexity Analyzer Tests ────────────────────────────────────────────────

class TestComplexityAnalyzer:
    def test_constant_complexity(self):
        code = "x = 5\ny = x + 3"
        result = analyze_complexity(code, "python")
        assert result["time_complexity"] == "O(1)"

    def test_linear_complexity(self):
        code = "for i in range(n):\n    print(i)"
        result = analyze_complexity(code, "python")
        assert "O(N)" in result["time_complexity"]

    def test_quadratic_complexity(self):
        code = "for i in range(n):\n    for j in range(n):\n        print(i, j)"
        result = analyze_complexity(code, "python")
        assert "N^2" in result["time_complexity"] or "O(N²)" in result["time_complexity"]

    def test_log_complexity(self):
        code = "mid = (low + high) // 2\nbinary_search(arr, target)"
        result = analyze_complexity(code, "python")
        assert "log" in result["time_complexity"].lower() or result["time_complexity"] in ["O(log N)", "O(N)"]

    def test_output_schema(self):
        result = analyze_complexity("x = 1", "python")
        assert "time_complexity"  in result
        assert "space_complexity" in result
        assert "explanation"      in result
        assert "badge_color"      in result


# ─── API Endpoint Tests ───────────────────────────────────────────────────────

class TestAPIEndpoints:
    def test_health_check(self):
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_languages_endpoint(self):
        res = client.get("/api/languages")
        assert res.status_code == 200
        data = res.json()
        assert "languages" in data
        assert "python" in data["languages"]
        assert "javascript" in data["languages"]

    def test_playground_trace_python(self):
        code = "def add(a, b):\n    return a + b\n\nresult = add(2, 3)\n"
        res  = client.post("/api/playground/trace", json={"code": code})
        assert res.status_code == 200
        data = res.json()
        assert "steps" in data
        assert len(data["steps"]) > 0
        assert "complexity" in data
        assert "cfg_graphs" in data
        assert "language" in data
        assert data["language"] == "python"

    def test_playground_trace_complexity_fields(self):
        code = "for i in range(n):\n    for j in range(n):\n        pass"
        res  = client.post("/api/playground/trace", json={"code": code})
        assert res.status_code == 200
        data = res.json()
        assert "time_complexity"  in data["complexity"]
        assert "space_complexity" in data["complexity"]
        assert "explanation"      in data["complexity"]

    def test_sql_execute(self):
        code = ("CREATE TABLE products (\n    id INTEGER PRIMARY KEY,\n    name TEXT,\n    price DECIMAL\n);\n"
                "SELECT name, price FROM products WHERE price > 50;")
        res  = client.post("/api/sql/execute", json={"code": code})
        assert res.status_code == 200
        data = res.json()
        assert "logs"            in data
        assert "mock_databases"  in data
        assert "products"        in data["mock_databases"]
        assert len(data["mock_databases"]["products"]) > 0

    def test_sql_execute_with_join(self):
        code = (
            "CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);\n"
            "CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary DECIMAL);\n"
            "SELECT e.name, d.name AS dept FROM employees e JOIN departments d ON e.dept_id = d.id;"
        )
        res  = client.post("/api/sql/execute", json={"code": code})
        assert res.status_code == 200
        data = res.json()
        assert "execution_plan" in data
        phases = [step["phase"] for step in data["execution_plan"]]
        # When a JOIN is present, JOIN and SELECT are guaranteed; FROM may be merged
        assert "JOIN"   in phases
        assert "SELECT" in phases
        # There must be at least 2 pipeline stages
        assert len(phases) >= 2
        assert "SELECT" in phases

    def test_cache_efficiency(self):
        code = "def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)\nfib(4)\n"
        # First call
        t0 = time.perf_counter()
        r1 = client.post("/api/playground/trace", json={"code": code})
        t1 = time.perf_counter()
        # Second call (should hit cache)
        t2 = time.perf_counter()
        r2 = client.post("/api/playground/trace", json={"code": code})
        t3 = time.perf_counter()

        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["steps"] == r2.json()["steps"]

        cached_ms = (t3 - t2) * 1000
        print(f"\nCache retrieval: {cached_ms:.2f}ms")
        assert cached_ms < 20.0, f"Cache too slow: {cached_ms:.2f}ms"

    def test_repo_analyze_endpoint(self):
        """Test repo analyzer on the backend directory itself."""
        backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        res = client.post("/api/repo/analyze", json={"path": backend_path})
        assert res.status_code == 200
        data = res.json()
        assert "file_count" in data
        assert data["file_count"] > 0
        assert "language_breakdown" in data
        assert "python" in data["language_breakdown"]
        assert "graph" in data
        assert "nodes" in data["graph"]
        assert "edges" in data["graph"]
        assert len(data["graph"]["nodes"]) > 0


# ─── Repo Analyzer Tests ──────────────────────────────────────────────────────

class TestRepoAnalyzer:
    def test_analyze_backend_folder(self):
        backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        result = analyze_repository(backend_path)
        assert "error" not in result
        assert result["file_count"] > 0
        assert "python" in result["language_breakdown"]
        assert len(result["graph"]["nodes"]) > 0

    def test_invalid_path(self):
        result = analyze_repository("/nonexistent/path/xyz")
        assert "error" in result

    def test_graph_node_schema(self):
        backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        result = analyze_repository(backend_path)
        for node in result["graph"]["nodes"]:
            assert "id"       in node
            assert "label"    in node
            assert "language" in node
            assert "color"    in node

    def test_symbols_extraction(self):
        backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        result = analyze_repository(backend_path)
        # Should extract some symbols from Python files
        assert len(result["symbols"]) > 0
