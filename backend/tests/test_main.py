import sys
import os
import time
import pytest
from fastapi.testclient import TestClient

# Add parent directory of tests folder (which is backend/) to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from engines.language_detector import detect_language
from engines.snippet_analyzer import analyze_complexity

client = TestClient(app)

def test_language_detection():
    py_code = "def test():\n    print('hello')"
    cpp_code = "#include <iostream>\nint main() { return 0; }"
    
    assert detect_language(py_code) == "python"
    assert detect_language(cpp_code) == "cpp"

def test_complexity_analyzer():
    py_code = "for i in range(n):\n    print(i)"
    c_complexity = analyze_complexity(py_code, "python")
    
    assert "O(" in c_complexity["time_complexity"]
    assert "O(" in c_complexity["space_complexity"]
    assert c_complexity["badge_color"] in ["green", "amber", "red", "blue"]

def test_api_playground_trace():
    code = """
def sum_n(n):
    total = 0
    for i in range(1, n + 1):
        total += i
    return total

res = sum_n(3)
"""
    response = client.post("/api/playground/trace", json={"code": code})
    assert response.status_code == 200
    data = response.json()
    
    assert "steps" in data
    assert len(data["steps"]) > 0
    assert "cfg_graphs" in data
    assert "global" in data["cfg_graphs"]
    assert "sum_n" in data["cfg_graphs"]
    
    # Assert node IDs exist inside generated SVGs
    assert "cfg_node_2" in data["cfg_graphs"]["global"]

def test_database_cache_efficiency():
    # Performance & Speed optimization test
    code = """
def test_speed_check():
    a = 10
    b = 20
    return a + b
"""
    # 1. First run: uncached, runs compilation
    t0 = time.perf_counter()
    response1 = client.post("/api/playground/trace", json={"code": code})
    t1 = time.perf_counter()
    duration1 = (t1 - t0) * 1000
    
    assert response1.status_code == 200
    
    # 2. Second run: cached, loads instantly from SQLite
    t2 = time.perf_counter()
    response2 = client.post("/api/playground/trace", json={"code": code})
    t3 = time.perf_counter()
    duration2 = (t3 - t2) * 1000
    
    assert response2.status_code == 200
    assert response1.json() == response2.json()
    
    print(f"\nUncached compilation speed: {duration1:.2f}ms")
    print(f"Cached DB retrieval speed: {duration2:.2f}ms")
    
    # Assert cache retrieval is optimized and takes under 15ms
    assert duration2 < 15.0, f"Database cache took too long: {duration2:.2f}ms"

def test_fallback_tracer():
    # Test that C++ fallback tracing runs successfully
    cpp_code = """
int main() {
    int total = 0;
    for (int i = 0; i < 3; i++) {
        total += i;
    }
    return total;
}
"""
    response = client.post("/api/playground/trace", json={"code": cpp_code})
    assert response.status_code == 200
    data = response.json()
    
    assert data["language"] == "cpp"
    assert "steps" in data
    assert len(data["steps"]) > 0
    # The C++ fallback tracer compiles a global sequence chart
    assert "cfg_graphs" in data
    assert "global" in data["cfg_graphs"]

def test_sql_endpoints():
    # Test static SQL pipeline data endpoints
    res_pipeline = client.get("/api/sql/pipeline")
    assert res_pipeline.status_code == 200
    data_pipeline = res_pipeline.json()
    assert "steps" in data_pipeline
    assert len(data_pipeline["steps"]) > 0

    res_optimizer = client.get("/api/sql/optimizer")
    assert res_optimizer.status_code == 200
    data_optimizer = res_optimizer.json()
    assert "steps" in data_optimizer
    assert len(data_optimizer["steps"]) > 0

