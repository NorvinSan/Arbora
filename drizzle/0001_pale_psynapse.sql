CREATE TYPE "public"."collaborator_role" AS ENUM('editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."date_qualifier" AS ENUM('exact', 'approximate', 'before', 'after');--> statement-breakpoint
CREATE TYPE "public"."person_event_type" AS ENUM('birth', 'death', 'disappearance', 'last_contact', 'found', 'other');--> statement-breakpoint
CREATE TYPE "public"."life_status" AS ENUM('living', 'deceased', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."parent_relation_type" AS ENUM('biological', 'adoptive', 'other');--> statement-breakpoint
CREATE TYPE "public"."partnership_kind" AS ENUM('marriage', 'partnership', 'other');--> statement-breakpoint
CREATE TYPE "public"."whereabouts_status" AS ENUM('known', 'missing', 'unknown');--> statement-breakpoint
CREATE TABLE "family_story" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"person_id" uuid,
	"author_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_story_title_nonempty" CHECK (length(btrim("family_story"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "family_tree" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_tree_name_nonempty" CHECK (length(btrim("family_tree"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "parent_child" (
	"tree_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"relation_type" "parent_relation_type" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_child_tree_id_parent_id_child_id_pk" PRIMARY KEY("tree_id","parent_id","child_id"),
	CONSTRAINT "parent_child_no_self" CHECK ("parent_child"."parent_id" <> "parent_child"."child_id")
);
--> statement-breakpoint
CREATE TABLE "partnership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"person_a_id" uuid NOT NULL,
	"person_b_id" uuid NOT NULL,
	"kind" "partnership_kind" NOT NULL,
	"start_year" integer,
	"start_month" integer,
	"start_day" integer,
	"start_qualifier" date_qualifier,
	"end_year" integer,
	"end_month" integer,
	"end_day" integer,
	"end_qualifier" date_qualifier,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partnership_canonical_pair" CHECK ("partnership"."person_a_id" < "partnership"."person_b_id"),
	CONSTRAINT "partnership_start_date_valid" CHECK ((
    ("partnership"."start_year" is null and "partnership"."start_month" is null and "partnership"."start_day" is null and "partnership"."start_qualifier" is null)
    or (
      "partnership"."start_year" is not null
      and
      "partnership"."start_year" between 1 and 9999
      and "partnership"."start_qualifier" is not null
      and ("partnership"."start_month" is null or "partnership"."start_month" between 1 and 12)
      and ("partnership"."start_day" is null or ("partnership"."start_month" is not null and "partnership"."start_day" between 1 and 31))
      and case
        when "partnership"."start_month" between 1 and 12 and "partnership"."start_day" is not null
          then "partnership"."start_day" <= extract(day from (make_date("partnership"."start_year", "partnership"."start_month", 1) + interval '1 month - 1 day'))
        else true
      end
    )
  )),
	CONSTRAINT "partnership_end_date_valid" CHECK ((
    ("partnership"."end_year" is null and "partnership"."end_month" is null and "partnership"."end_day" is null and "partnership"."end_qualifier" is null)
    or (
      "partnership"."end_year" is not null
      and
      "partnership"."end_year" between 1 and 9999
      and "partnership"."end_qualifier" is not null
      and ("partnership"."end_month" is null or "partnership"."end_month" between 1 and 12)
      and ("partnership"."end_day" is null or ("partnership"."end_month" is not null and "partnership"."end_day" between 1 and 31))
      and case
        when "partnership"."end_month" between 1 and 12 and "partnership"."end_day" is not null
          then "partnership"."end_day" <= extract(day from (make_date("partnership"."end_year", "partnership"."end_month", 1) + interval '1 month - 1 day'))
        else true
      end
    )
  ))
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"given_name" text,
	"family_name" text,
	"preferred_name" text,
	"biography" text,
	"life_status" "life_status" DEFAULT 'unknown' NOT NULL,
	"whereabouts_status" "whereabouts_status" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_tree_id_id_unique" UNIQUE("tree_id","id"),
	CONSTRAINT "person_display_name_nonempty" CHECK (length(btrim("person"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "person_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"type" "person_event_type" NOT NULL,
	"year" integer,
	"month" integer,
	"day" integer,
	"qualifier" date_qualifier,
	"place" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_event_date_valid" CHECK ((
    ("person_event"."year" is null and "person_event"."month" is null and "person_event"."day" is null and "person_event"."qualifier" is null)
    or (
      "person_event"."year" is not null
      and
      "person_event"."year" between 1 and 9999
      and "person_event"."qualifier" is not null
      and ("person_event"."month" is null or "person_event"."month" between 1 and 12)
      and ("person_event"."day" is null or ("person_event"."month" is not null and "person_event"."day" between 1 and 31))
      and case
        when "person_event"."month" between 1 and 12 and "person_event"."day" is not null
          then "person_event"."day" <= extract(day from (make_date("person_event"."year", "person_event"."month", 1) + interval '1 month - 1 day'))
        else true
      end
    )
  ))
);
--> statement-breakpoint
CREATE TABLE "tree_collaborator" (
	"tree_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "collaborator_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tree_collaborator_tree_id_user_id_pk" PRIMARY KEY("tree_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "family_story" ADD CONSTRAINT "family_story_tree_id_family_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_story" ADD CONSTRAINT "family_story_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_story" ADD CONSTRAINT "family_story_tree_id_person_id_person_tree_id_id_fk" FOREIGN KEY ("tree_id","person_id") REFERENCES "public"."person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_tree" ADD CONSTRAINT "family_tree_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_tree_id_family_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_tree_id_parent_id_person_tree_id_id_fk" FOREIGN KEY ("tree_id","parent_id") REFERENCES "public"."person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_tree_id_child_id_person_tree_id_id_fk" FOREIGN KEY ("tree_id","child_id") REFERENCES "public"."person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_tree_id_family_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_tree_id_person_a_id_person_tree_id_id_fk" FOREIGN KEY ("tree_id","person_a_id") REFERENCES "public"."person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_tree_id_person_b_id_person_tree_id_id_fk" FOREIGN KEY ("tree_id","person_b_id") REFERENCES "public"."person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_tree_id_family_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_event" ADD CONSTRAINT "person_event_tree_id_family_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_event" ADD CONSTRAINT "person_event_tree_id_person_id_person_tree_id_id_fk" FOREIGN KEY ("tree_id","person_id") REFERENCES "public"."person"("tree_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_collaborator" ADD CONSTRAINT "tree_collaborator_tree_id_family_tree_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."family_tree"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_collaborator" ADD CONSTRAINT "tree_collaborator_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "family_story_tree_person_idx" ON "family_story" USING btree ("tree_id","person_id");--> statement-breakpoint
CREATE INDEX "family_tree_owner_idx" ON "family_tree" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "parent_child_child_idx" ON "parent_child" USING btree ("tree_id","child_id");--> statement-breakpoint
CREATE INDEX "partnership_person_a_idx" ON "partnership" USING btree ("tree_id","person_a_id");--> statement-breakpoint
CREATE INDEX "partnership_person_b_idx" ON "partnership" USING btree ("tree_id","person_b_id");--> statement-breakpoint
CREATE INDEX "person_tree_name_idx" ON "person" USING btree ("tree_id","family_name","given_name");--> statement-breakpoint
CREATE INDEX "person_tree_display_name_idx" ON "person" USING btree ("tree_id","display_name");--> statement-breakpoint
CREATE INDEX "person_event_person_idx" ON "person_event" USING btree ("tree_id","person_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "person_event_one_birth_idx" ON "person_event" USING btree ("tree_id","person_id") WHERE "person_event"."type" = 'birth';--> statement-breakpoint
CREATE UNIQUE INDEX "person_event_one_death_idx" ON "person_event" USING btree ("tree_id","person_id") WHERE "person_event"."type" = 'death';--> statement-breakpoint
CREATE INDEX "tree_collaborator_user_idx" ON "tree_collaborator" USING btree ("user_id");