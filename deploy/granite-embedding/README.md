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

## Regenerating occupation vectors without local Docker

The CVM always runs a Granite container; the staging one is published on the
host at `127.0.0.1:8001` (`deployment/docker-compose.staging.yml`) and serves
the same model as production (`granite-embedding-97m-multilingual-r2`). From a
machine with SSH access:

```bash
# 1. Tunnel to the staging Granite container
ssh -i ~/.ssh/OpenCode.pem -f -N -L 8001:127.0.0.1:8001 root@1.12.243.104

# 2. Regenerate (run from apps/server)
EMBEDDING_BASE_URL=http://localhost:8001/v1 npx tsx scripts/build-occupation-vectors.mts

# 3. Close the tunnel
pkill -f '8001:127.0.0.1:8001'
```

After regenerating, empty `OCCUPATIONS_AWAITING_VECTORS` in
`apps/server/src/__tests__/occupationVectorDrift.test.ts` (the tripwire fails
until you do) and commit the refreshed `apps/server/data/occupation-vectors.json`.

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
