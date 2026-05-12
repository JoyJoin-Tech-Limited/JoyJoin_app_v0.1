from __future__ import annotations

"""Granite embedding server — OpenAI-compatible /v1/embeddings endpoint."""

import os
import time
from typing import Union, List
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Granite Embedding Server")

start = time.time()
print(f"[init] Loading model ibm-granite/granite-embedding-97m-multilingual-r2...")
model = SentenceTransformer(
    "ibm-granite/granite-embedding-97m-multilingual-r2",
    model_kwargs={"trust_remote_code": True},
)
print(f"[init] Model loaded in {time.time() - start:.1f}s")


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
    t0 = time.time()
    vectors = model.encode(texts, normalize_embeddings=True).tolist()
    t1 = time.time()
    data = [EmbeddingData(index=i, embedding=vec) for i, vec in enumerate(vectors)]
    total_chars = sum(len(t) for t in texts)
    return EmbeddingResponse(
        data=data,
        model=req.model,
        usage=Usage(prompt_tokens=total_chars, total_tokens=total_chars),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
