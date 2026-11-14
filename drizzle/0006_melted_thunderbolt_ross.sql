CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"uploaded_by" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_tree_id_id_unique" UNIQUE("tree_id","id"),
	CONSTRAINT "media_size_positive" CHECK ("media"."file_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "person_media" (
	"tree_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"is_profile" boolean DEFAULT false NOT NULL,
	CONSTRAINT "person_media_tree_id_media_id_person_id_pk" PRIMARY KEY("tree_id","media_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_tree_id_family_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_media" ADD CONSTRAINT "person_media_tree_id_media_id_media_tree_id_id_fk" FOREIGN KEY ("tree_id","media_id") REFERENCES "public"."media"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_media" ADD CONSTRAINT "person_media_tree_id_person_id_person_tree_id_id_fk" FOREIGN KEY ("tree_id","person_id") REFERENCES "public"."person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_tree_created_idx" ON "media" USING btree ("tree_id","created_at");--> statement-breakpoint
CREATE INDEX "person_media_person_idx" ON "person_media" USING btree ("tree_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_media_one_profile_idx" ON "person_media" USING btree ("tree_id","person_id") WHERE "person_media"."is_profile" = true;