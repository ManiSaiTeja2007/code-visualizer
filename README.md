# CodeVisualizer: Interactive 3D Execution Simulator

CodeVisualizer is an advanced, highly interactive **3D Execution Simulation Suite** designed to teach code execution, compilation paths, and memory dynamics. Rather than just parsing code, the app replicates system-level behaviors—such as stack frames building upwards, dynamic heap malloc segments, pointer alignments, database query optimization pipelines, and algorithmic efficiency steps.

---

## 🚀 Key Features

*   **⚡ Zero-Latency Playback**: Executes traces entirely client-side. The compiler bundles execution steps and flowcharts in a single payload, allowing 60 FPS lag-free stepping.
*   **🧱 3D Memory Simulator**: Visualizes RAM stack frames growing upwards. Blocks stack on top of each other dynamically on push/pop steps, while pointers trace glowing vector connector paths.
*   **📊 Multi-Language Tracer**: Detects languages automatically (Python, C++, Go, PHP) and compiles trace scopes with built-in Big O time and space complexity estimations.
*   **🗄️ SQL Engine Pipeline**: Steps through the relational algebra stages of SQL execution (FROM → JOIN → WHERE → SELECT) to demonstrate how database engines index and filter datasets.
*   **🔎 Search Performance Comparer**: Animates side-by-side comparisons of Linear and Binary search, showing elements elevating in 3D perspective space as they are evaluated.
*   **💾 Persistent Cache Registry**: Saves trace records in an SQLite database. Identical runs return cached payloads in **< 5ms**.

---

## 📂 Project Architecture

```text
├── /backend
│   ├── /components         # Control flowchart, SQL, and memory rendering builders
│   ├── /engines            # Python execution tracer, AST parser, and language detectors
│   ├── database.py         # SQLite persistent caching helper
│   ├── Dockerfile          # Python image config with system Graphviz dependencies
│   └── main.py             # FastAPI entry routing
│
└── /frontend
    ├── /src
    │   ├── /components     # 3D memory SVG bricks and Control Flow Graph nodes
    │   ├── /modules        # Workspace tabs (Playground, CMemory, SQLExecution, SearchPerformance)
    │   └── App.tsx         # Dashboard layout shell with lazy-loaded code-split modules
    ├── vite.config.ts      # Rollup code splitting configuration (< 16 kB chunks)
    └── Dockerfile          # Multi-stage production build (Node.js compile -> Nginx serve)
```

---

## 🐋 Getting Started with Docker (Recommended)

To run the entire suite (FastAPI backend + Nginx-served Vite React client) using Docker containers:

1.  **Prerequisites**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2.  **Start Services**: Run the following command in the root folder:
    ```bash
    docker-compose up --build
    ```
3.  **Access Apps**:
    *   **Web Client**: Open [http://localhost:4173/](http://localhost:4173/)
    *   **API Documentation**: Open [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 💻 Running Locally (Development Mode)

If you prefer to run the services bare-metal without Docker, proceed as follows:

### 1. Backend Setup
From the project root:
```bash
# Create and activate python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install requirements (ensure you have Graphviz binaries installed on your OS)
pip install -r backend/requirements.txt

# Launch FastAPI uvicorn server
python backend/main.py
```
*Backend runs on [http://localhost:8000](http://localhost:8000)*

### 2. Frontend Setup
From the `/frontend` directory:
```bash
# Install node packages
npm install

# Compile the modular production bundle
npm run build

# Boot local preview server
npm run preview
```
*Frontend runs on [http://localhost:4173/](http://localhost:4173/)*
