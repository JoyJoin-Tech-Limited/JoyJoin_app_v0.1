FROM python:3.11-slim

# hf-mirror.com: HuggingFace is unreliable from mainland-CVM deploy targets.
# The model is baked into the image at build time so the container starts
# without any network access to HF.
ENV HF_ENDPOINT=https://hf-mirror.com

# pypi.tuna.tsinghua.edu.cn: direct PyPI measured at ~10 kB/s from the
# production CVM (stalls on large wheels); torch keeps its own CDN index
# which measured ~2 MB/s.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple sentence-transformers fastapi uvicorn

COPY server.py /app/server.py
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('ibm-granite/granite-embedding-97m-multilingual-r2', model_kwargs={'trust_remote_code': True})"

EXPOSE 8000

CMD ["uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8000"]
