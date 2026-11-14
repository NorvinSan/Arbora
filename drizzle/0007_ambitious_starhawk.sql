ALTER TABLE "media" ADD COLUMN "kind" text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "document_type" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "historical_date" date;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE INDEX "media_tree_hash_idx" ON "media" USING btree ("tree_id","content_hash");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_kind_valid" CHECK ("media"."kind" in ('photo', 'document'));--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_document_fields" CHECK ("media"."kind" = 'photo' or ("media"."title" is not null and "media"."document_type" in ('birth', 'marriage', 'death', 'letter', 'record', 'other')));