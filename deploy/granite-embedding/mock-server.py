"""
Mock embedding server for offline dev / CI.

Returns deterministic 384-dim vectors (hash-based) so the pipeline
works end-to-end without downloading the real Granite model.

Usage:
  python3 mock-server.py  # starts on port 8000
"""

import hashlib
import struct
import uvicorn
from typing import Union, List
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Mock Embedding Server (Granite-compatible)")
DIM = 384


def pseudo_embedding(text: str) -> list[float]:
    """Deterministic 384-dim vector from text hash (seed-based)."""
    h = hashlib.sha256(text.encode("utf-8")).digest()
    seed = struct.unpack(">Q", h[:8])[0]
    rng = seed
    vec = []
    for _ in range(DIM):
        rng = (rng * 6364136223846793005 + 1) & 0xFFFFFFFFFFFFFFFF
        vec.append((rng >> 32) / 2**32)
    norm = sum(v * v for v in vec) ** 0.5
    return [v / norm for v in vec]


class EmbeddingRequest(BaseModel):
    model: str = "granite-embedding-97m-multilingual-r2"
    input: Union[str, List[str]]


class EmbeddingData(BaseModel):
    object: str = "embedding"
    index: int
    embedding: list[float]


class Usage(BaseModel):
    prompt_tokens: int
    total_tokens: int


class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: list[EmbeddingData]
    model: str
    usage: Usage


@app.post("/v1/embeddings")
async def embed(req: EmbeddingRequest):
    texts = [req.input] if isinstance(req.input, str) else req.input
    data = [EmbeddingData(index=i, embedding=pseudo_embedding(t)) for i, t in enumerate(texts)]
    total_chars = sum(len(t) for t in texts)
    return EmbeddingResponse(data=data, model=req.model, usage=Usage(prompt_tokens=total_chars, total_tokens=total_chars))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
