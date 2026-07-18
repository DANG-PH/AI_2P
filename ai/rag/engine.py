"""
Tầng 0.5 — RAG Domain Knowledge Layer

Pipeline: Tài liệu → chunk → embedding → Vector DB cục bộ.
Truy xuất real-time: query top-k đoạn liên quan cho LLM prompt.
Target retrieval: <100-150ms.
"""

from typing import List, Optional


class DocumentChunk:
    """Một đoạn tài liệu đã được chunk."""

    def __init__(self, text: str, source: str, metadata: Optional[dict] = None):
        self.text = text
        self.source = source
        self.metadata = metadata or {}


class RAGEngine:
    """
    Vector DB cục bộ cho domain knowledge.

    Edge: FAISS/Chroma nhẹ
    Server: Chroma/Milvus/pgvector
    """

    def __init__(self):
        self._index = None  # ponytail: sẽ init FAISS hoặc Chroma tuỳ tier

    def ingest_document(self, file_path: str) -> int:
        """Nạp tài liệu: chunk → embed → lưu. Trả số chunks."""
        raise NotImplementedError

    def retrieve(self, query: str, top_k: int = 5) -> List[DocumentChunk]:
        """
        Truy xuất top-k đoạn liên quan nhất.
        Phải < 100-150ms, nếu không kịp trả list rỗng (không chặn pipeline).
        """
        raise NotImplementedError

    def add_session_transcript(self, transcript: str, session_id: str) -> None:
        """Sau buổi họp: embed transcript để RAG buổi sau giàu hơn."""
        raise NotImplementedError
