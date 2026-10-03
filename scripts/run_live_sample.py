import json
import urllib.request
import time
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

API_URL = "http://127.0.0.1:8000/v1/chat"

SAMPLES = [
    {
        "title": "1. Code Generation & Analysis",
        "task_type": "code",
        "message": "Write a thread-safe in-memory cache in Python with TTL expiration and complete type annotations.",
        "context": [
            {
                "type": "code_snippet",
                "content": "Requirement: Must use threading.Lock() and time.monotonic() for exact TTL precision.",
                "importance": 0.95
            }
        ],
        "max_context_tokens": 4000
    },
    {
        "title": "2. Structured Architecture Extraction",
        "task_type": "structured_extraction",
        "message": "Extract all microservices, databases, and message queues into a structured JSON list from the provided system specification.",
        "context": [
            {
                "type": "document",
                "content": "Architecture Specification: UserAuthService talks to PostgreSQL for credentials and publishes user_created events to RabbitMQ. OrderService reads from MongoDB and dispatches delivery tasks to Celery worker queue with Redis broker.",
                "importance": 1.0
            }
        ],
        "max_context_tokens": 4000
    },
    {
        "title": "3. Analytical Comparison",
        "task_type": "analytical",
        "message": "Compare Redis vs Memcached for distributed session caching under heavy write workloads.",
        "context": [
            {
                "type": "document",
                "content": "Production stats: 100,000 active sessions, average payload 2KB, 99.9% uptime requirement, Redis cluster currently configured with LRU eviction.",
                "importance": 0.85
            }
        ],
        "max_context_tokens": 4000
    },
    {
        "title": "4. Factual / RAG Query",
        "task_type": "factual",
        "message": "What is the primary failover policy described in the disaster recovery handbook?",
        "context": [
            {
                "type": "document",
                "content": "Disaster Recovery Policy (v3.2): Section 4.1 states that in the event of primary zone failure, traffic automatically reroutes to us-east-2 secondary standby within 45 seconds via Route53 DNS health checks.",
                "importance": 0.9
            }
        ],
        "max_context_tokens": 4000
    }
]

def run_sample(sample):
    print("=" * 70)
    print(f"[*] Running: {sample['title']}")
    print(f"Task Type: {sample['task_type']}")
    print(f"User Query: {sample['message']}")
    
    payload = {
        "task_type": sample["task_type"],
        "message": sample["message"],
        "context": sample.get("context", []),
        "max_context_tokens": sample.get("max_context_tokens", 4000)
    }
    
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    start = time.time()
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elapsed = round((time.time() - start) * 1000, 2)
            
            print(f"\n[+] Status: SUCCESS ({elapsed} ms total round-trip)")
            print(f"Model Used: {data['policy']['model']}")
            print(f"Token Usage: {data['usage']['input_tokens']} in / {data['usage']['output_tokens']} out (Total: {data['usage']['total_tokens']})")
            print(f"Compression Ratio: {data['metrics']['context_compression_ratio']}")
            print(f"\n[Response Content]:\n{data['answer']}\n")
    except Exception as e:
        print(f"\n[-] Execution Failed: {e}")

if __name__ == "__main__":
    print("Testing ContextOS with Real Production Sample Data\n")
    for sample in SAMPLES:
        run_sample(sample)
    print("=" * 70)
    print("[+] All samples completed! View live telemetry in your dashboard at http://localhost:3000")
