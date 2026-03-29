# HTTP Client Infrastructure

**DO NOT create your own httpx/aiohttp/requests clients.** Use `ServiceClient` for all inter-service calls.

## ServiceClient (what you use)

```python
from src.agentic_platform.core.infra.http_client import ServiceClient

client = ServiceClient("campaign-service", base_url="http://campaign-svc:8080")
resp = await client.get("/campaigns/", params={"org_id": "123"})
data = resp["body"]
```

### Constructor
`ServiceClient(service_name: str, base_url: str, default_headers: dict = None)`

### Methods
All return `{"status_code": int, "headers": dict, "body": Any, "elapsed_ms": float}`.

- `async get(path, *, params, headers, timeout, retry_attempts)`
- `async post(path, *, json, data, params, headers, timeout, retry_attempts)`
- `async put(path, *, json, data, params, headers, timeout, retry_attempts)`
- `async patch(path, *, json, data, params, headers, timeout, retry_attempts)`
- `async delete(path, *, params, headers, timeout, retry_attempts)`

### What it does automatically
- **Connection pooling** via shared `AsyncHTTPClient` singleton
- **Retry** with exponential backoff + jitter (default: 3 attempts)
- **Circuit breaker** per service name (opens after 5 failures, recovers in 30s)
- **Prometheus metrics** (request count, duration, errors)
- **Auth token forwarding** from `request_auth_token` ContextVar

### Configuration (via env vars)
| Env Var | Default | Description |
|---------|---------|-------------|
| `HTTP_CLIENT_TIMEOUT` | 30 | Request timeout (seconds) |
| `HTTP_CLIENT_CONNECT_TIMEOUT` | 10 | Connection timeout |
| `HTTP_CLIENT_MAX_CONNECTIONS` | 100 | Pool size |
| `HTTP_RETRY_MAX_ATTEMPTS` | 3 | Retry attempts |
| `HTTP_RETRY_BASE_DELAY` | 1.0 | Base backoff delay |
| `HTTP_CB_ENABLED` | true | Enable circuit breakers |
| `HTTP_CB_FAILURE_THRESHOLD` | 5 | Failures before open |
| `HTTP_CB_RECOVERY_TIMEOUT` | 30.0 | Half-open timeout |

### Retried status codes
408, 429, 500, 502, 503, 504 (configurable)

### Exceptions
- `HTTPStatusError(status_code, response_body)` — non-2xx response
- `ConnectionError` — can't reach host
- `RequestTimeout` — deadline exceeded

## AsyncHTTPClient (internal — don't use directly)

Singleton managed by `api/server.py` lifespan:
```python
await AsyncHTTPClient.initialize()  # startup
await AsyncHTTPClient.close()       # shutdown
```

`ServiceClient` calls this internally. You never need to touch it.
