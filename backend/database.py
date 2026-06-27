import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS traces (
            code_hash TEXT PRIMARY KEY,
            code TEXT,
            language TEXT,
            complexity TEXT,
            steps TEXT,
            cfg_graphs TEXT
        )
    """)
    conn.commit()
    conn.close()

def get_cached_trace(code_hash: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT language, complexity, steps, cfg_graphs FROM traces WHERE code_hash = ?",
        (code_hash,)
    )
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "language": row[0],
            "complexity": json.loads(row[1]),
            "steps": json.loads(row[2]),
            "cfg_graphs": json.loads(row[3])
        }
    return None

def cache_trace(code_hash: str, code: str, language: str, complexity: dict, steps: list, cfg_graphs: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO traces (code_hash, code, language, complexity, steps, cfg_graphs)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            code_hash,
            code,
            language,
            json.dumps(complexity),
            json.dumps(steps),
            json.dumps(cfg_graphs)
        )
    )
    conn.commit()
    conn.close()

# Initialize database on module load
init_db()
