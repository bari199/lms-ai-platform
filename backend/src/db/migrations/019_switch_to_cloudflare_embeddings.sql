DROP INDEX IF EXISTS document_chunks_embedding_idx;

ALTER TABLE document_chunks
ALTER COLUMN embedding TYPE VECTOR(768)
USING embedding::VECTOR(768);

CREATE INDEX document_chunks_embedding_idx
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
