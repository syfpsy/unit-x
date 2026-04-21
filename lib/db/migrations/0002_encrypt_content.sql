-- Phase 5 — envelope encryption at rest.
-- Adds bytea columns for ciphertext + nonce on messages and memories and
-- drops the plaintext text columns. The DB is empty after Phase 4's wipe
-- so no backfill is required; encryption begins with the next write.

ALTER TABLE "messages" ADD COLUMN "text_cipher" bytea;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "nonce" bytea;
--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "text";
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "text_cipher" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "nonce" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "memories" ADD COLUMN "text_cipher" bytea;
--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "nonce" bytea;
--> statement-breakpoint
ALTER TABLE "memories" DROP COLUMN "text";
--> statement-breakpoint
ALTER TABLE "memories" ALTER COLUMN "text_cipher" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "memories" ALTER COLUMN "nonce" SET NOT NULL;
