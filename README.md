# ContextOS — Production LLM Runtime API

ContextOS is an API-first LLM runtime designed for LLM systems engineering: context window management, dynamic compression, prompt compilation, adaptive inference policy selection, operational telemetry, and quantitative evaluation.

---

## 1. Problem Statement

Deploying LLMs in production applications requires more than wrapping an API call. Unmanaged context leads to:
- Context window overflow and high latency
- Excessive token expenditure
- Suboptimal model configuration across varying task types
- Lack of visibility into prompt composition and token metrics

ContextOS provides a production-grade runtime layer between your application client and LLM providers.

---

## 2. Architecture Diagram

```mermaid
flowchart TD
    Client[Client Request] -->|POST /v1/chat| API[FastAPI Gateway]
    API --> Val[Request Validation & Parsing]
    Val --> CBM[Context Budget Manager]
    CBM --> Comp[Prompt Compiler]
    Comp --> Policy[Adaptive Inference Policy Engine]
    Policy --> LLM[OpenAI API Client]
    LLM --> Res[Normalized Response]
    Res --> DB[(PostgreSQL Run Persistence)]
    Res --> Telemetry[OpenTelemetry & Structured Logging]
    Res --> Client
``

---

## 3. Key Design Decisions

1. **API-First Architecture**: Decoupled backend service built with FastAPI & Pydantic.
2. **Single-Point LLM Client (`LLMClient`)**: Centralized OpenAI SDK wrapper in `app/core/llm_client.py` providing normalized response objects (`LLMGenerationResult`), precise latency measurement, token usage tracking (`UsageMetadata`), and structured exception mapping (`LLMClientError`). No scattered OpenAI calls.
3. **Gatekeeper (Context Budgeting & Compression)**: Deterministic context engine in `app/core/context_manager.py` that scores items by composite priority `(0.6 * importance) + (0.4 * recency)`, preserves system directives & user queries, compresses lower-ranked context/history, and drops lowest-value items if budget threshold is exceeded.
4. **Assembly Line (Prompt Compilation & Versioning)**: Prompt compilation engine in `app/core/prompt_engine.py` that maps task policies (`factual`, `analytical`, `creative`, `code`, `structured_extraction`), injects output schemas, and stamps requests with version tags (`v1`, `v2`) for telemetry and evaluation tracking.
5. **Dispatcher (Adaptive Inference)**: Rules-based inference policy engine in `app/core/inference_policy.py` that dynamically assigns temperature (e.g. `0.1` for code/factual vs `0.7` for creative tasks) and token generation limits.
6. **Performance Inspector (Evaluation & Metrics)**: Benchmark evaluation harness (`evaluator.py`) running reproducible test suites, tracking quality scores, pass/fail rate, P95 latency, and streaming operational metrics to the Next.js observability dashboard.
7. **Observability & Persistence**: OpenTelemetry instrumentation, PostgreSQL run persistence (`LLMRunModel`), and structured JSON logging.

---

## 4. Context Management Algorithm (Gatekeeper)

The Context Budget Manager enforces a strict context window budget:
1. System instructions & current user message are strictly reserved and never dropped/compressed.
2. Output token budget is reserved.
3. Flexible context items (conversation history & context documents) are scored via composite ranking:
   $$\text{Rank Score} = 0.6 \times \text{Importance} + 0.4 \times \text{Recency}$$
4. If input tokens exceed budget:
   - Lower-ranked flexible items are compressed using heuristic history summarization.
   - Lowest-ranked items are dropped until `input_tokens <= max_context_tokens`.
5. Outputs `ManagedContext` containing compiled message list, input/original token estimates, compression ratio, and dropped items list.

---

## 5. Inference Policy

Adaptive inference policy assigns targeted models and generation parameters according to `task_type`:

| Task Type | Temperature | Strategy |
| :--- | :--- | :--- |
| `factual` | 0.1 | Conservative accuracy |
| `code` | 0.1 | Low variance code generation |
| `structured_extraction` | 0.0 | Deterministic output |
| `analytical` | 0.3 | Balanced reasoning |
| `creative` | 0.7 | Varied output generation |

---

## 6. Evaluation Methodology

A built-in benchmark harness (`POST /v1/evaluate`) runs standard test suites across:
- Quality score
- Latency (ms)
- Input, Output & Total token usage
- Context compression ratio

---

## 7. Observability

Structured JSON logging captures key execution parameters per request:
- `request_id`
- `latency_ms`
- `model`
- `task_type`
- `status`

*Sensitive data (API keys, raw authorization headers) are strictly redacted.*

---

## 8. Execution Modes & Infrastructure

ContextOS is designed to run in two operational modes:

### A. Standalone / Lightweight Mode (Default for Local Dev & Testing)
- **Zero External Dependencies**: No Docker, Redis, or Vector DBs (Qdrant/Chroma) required to run.
- **SQLite Auto-Fallback**: If PostgreSQL is not running, the database automatically falls back to a local SQLite database (`sqlite:///./contextos.db`).
- **In-Memory Pipeline**: Context budgeting, priority ranking, and prompt compilation run entirely in-memory with minimal latency.

### B. Production Infrastructure Mode (Docker Compose)
- **PostgreSQL**: Centralized run persistence, evaluation score tracking, and P95 telemetry aggregation across multiple instances.
- **Redis**: Distributed rate-limiting and shared response caching across multi-replica API deployments.
- **Vector DB Integration (Qdrant / Chroma / PGVector)**: ContextOS acts as the runtime layer *downstream* of vector search. Your application retrieves relevant document chunks from Qdrant/Pinecone and passes them in the `context` list; ContextOS Gatekeeper then dynamically ranks, prunes, and compresses them to fit exact token budgets.

```bash
# Optional: Spin up PostgreSQL and Redis with Docker Compose
docker-compose up --build
```

---

## 9. Local Setup

### Prerequisites
- Python 3.12+
- Docker & Docker Compose *(Optional — only for production Postgres/Redis)*

### Installation

```bash
# Clone and enter workspace
git clone <repository_url>
cd contextos

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### Running the API Server

```bash
# Start local FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir backend
```

### Running Tests

```bash
python -m pytest backend/tests
```

### Docker Compose Setup

```bash
docker-compose up --build
```

---

## 10. API Examples & Live Test Samples

### 1. Health Check
```bash
curl http://127.0.0.1:8000/health
```
**Expected Output:**
```json
{
  "status": "ok",
  "environment": "development",
  "version": "0.1.0"
}
```

---

### 2. Live Chat Request (Code Generation Sample)
**Request:**
```bash
curl -X POST http://127.0.0.1:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "code",
    "message": "Write a Python function to check if a number is prime with type hints.",
    "context": [
      {
        "type": "code_snippet",
        "content": "Requirement: Must handle negative numbers and return bool.",
        "importance": 0.95
      }
    ],
    "max_context_tokens": 4000
  }'
```

**Expected Output Structure:**
```json
{
  "request_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "answer": "```python\ndef is_prime(n: int) -> bool:\n    if n <= 1:\n        return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\n```",
  "usage": {
    "input_tokens": 145,
    "output_tokens": 92,
    "total_tokens": 237
  },
  "metrics": {
    "latency_ms": 780.4,
    "context_compression_ratio": 1.0
  },
  "policy": {
    "task_type": "code",
    "model": "openai/gpt-oss-120b",
    "temperature": 0.1,
    "max_output_tokens": 1500
  }
}
```

---

### 3. Structured Extraction Sample
**Request:**
```bash
curl -X POST http://127.0.0.1:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "structured_extraction",
    "message": "Extract services, databases, and queues into a JSON object.",
    "context": [
      {
        "type": "document",
        "content": "Spec: AuthService writes to PostgreSQL and emits events to RabbitMQ.",
        "importance": 1.0
      }
    ]
  }'
```

**Expected Output:**
```json
{
  "services": ["AuthService"],
  "databases": ["PostgreSQL"],
  "queues": ["RabbitMQ"]
}
```

---

### 4. Running the Automated Live Sample Suite
To run all production scenarios in one command:
```powershell
.\venv\Scripts\python scripts/run_live_sample.py
```

---

## 11. Operational Telemetry & Metrics Summary
```bash
curl http://127.0.0.1:8000/v1/metrics
```
**Expected Output:**
```json
{
  "total_requests": 6,
  "avg_latency_ms": 1145.2,
  "p95_latency_ms": 3078.1,
  "avg_input_tokens": 182.5,
  "avg_output_tokens": 635.8,
  "avg_compression_ratio": 1.0,
  "pass_rate": 1.0
}
```

---

## 12. Deployment

- **Backend**: Render / Railway (`uvicorn app.main:app`)
- **Database**: Supabase / Managed PostgreSQL (auto-falls back to SQLite locally)
- **Cache**: Upstash Redis

---

## 13. Limitations

- v1 uses token approximation prior to full tiktoken integration.
- Standard single-node deployment (horizontal scaling behind load balancer).

