# Granite Embedding Server

Serves `ibm-granite/granite-embedding-97m-multilingual-r2` with an OpenAI-compatible `/v1/embeddings` endpoint.

## Production (Docker)

```bash
# Build and start
docker compose up -d

# Check logs
docker compose logs -f

# Test
curl -X POST http://localhost:8000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello world"}'
```

First startup downloads the ~390MB model from HuggingFace (~1-2 min on GPU, ~5 min on CPU).

## Dev mode (Python, no GPU)

Requires Python 3.9+ and `sentence-transformers`:

```bash
pip install sentence-transformers fastapi uvicorn
python3 server.py
```

## Configure JoyJoin to use it

Add to `.env`:

```
EMBEDDING_BASE_URL=http://localhost:8000/v1
EMBEDDING_MODEL=granite-embedding-97m-multilingual-r2
ENABLE_SEMANTIC_SIMILARITY=true
```

## Notes

- Model: `ibm-granite/granite-embedding-97m-multilingual-r2`
- Dimensions: 384
- License: Apache 2.0
- Architecture: BGE-like (BERT-based), 97M params
- Requires HuggingFace access for first download
