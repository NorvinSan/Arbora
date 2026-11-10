CREATE TABLE "story_person" (
	"tree_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "story_person_tree_id_story_id_person_id_pk" PRIMARY KEY("tree_id","story_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "family_story" DROP CONSTRAINT "family_story_tree_id_person_id_person_tree_id_id_fk";
--> statement-breakpoint
DROP INDEX "family_story_tree_person_idx";--> statement-breakpoint
ALTER TABLE "family_story" ADD CONSTRAINT "family_story_tree_id_id_unique" UNIQUE("tree_id","id");--> statement-breakpoint
ALTER TABLE "story_person" ADD CONSTRAINT "story_person_tree_id_story_id_family_story_tree_id_id_fk" FOREIGN KEY ("tree_id","story_id") REFERENCES "public"."family_story"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_person" ADD CONSTRAINT "story_person_tree_id_person_id_person_tree_id_id_fk" FOREIGN KEY ("tree_id","person_id") REFERENCES "public"."person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "story_person" ("tree_id", "story_id", "person_id") SELECT "tree_id", "id", "person_id" FROM "family_story" WHERE "person_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "story_person_tree_person_idx" ON "story_person" USING btree ("tree_id","person_id");--> statement-breakpoint
CREATE INDEX "family_story_tree_created_idx" ON "family_story" USING btree ("tree_id","created_at");--> statement-breakpoint
ALTER TABLE "family_story" DROP COLUMN "person_id";
