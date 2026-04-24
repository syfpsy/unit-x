-- Phase 12 — semantic memory (RAG).
-- Enables pgvector, adds embedding + embedding_model columns to memories,
-- and creates an HNSW cosine index. The index is partial (WHERE
-- embedding IS NOT NULL) so a row with no embedding yet doesn't bloat
-- the ANN structure, and similarity queries naturally skip it.

CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

-- Using 1536 dims to match OpenAI text-embedding-3-small default output.
-- The `embedding_model` column records which model produced the vector
-- so future rotations (e.g. moving to a different provider or dimension)
-- can re-embed in place without confusion. NULL = not yet embedded.
ALTER TABLE "memories" ADD COLUMN "embedding" vector(1536);
--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "embedding_model" varchar(64);
--> statement-breakpoint

-- HNSW index for approximate nearest-neighbour cosine lookup. Good
-- default for <1M rows; switch to IVFFlat for much larger sets.
CREATE INDEX "memories_embedding_cosine_idx" ON "memories"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
