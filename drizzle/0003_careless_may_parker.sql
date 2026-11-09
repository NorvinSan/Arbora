ALTER TYPE "public"."person_event_type" ADD VALUE 'marriage' BEFORE 'disappearance';--> statement-breakpoint
ALTER TYPE "public"."person_event_type" ADD VALUE 'move' BEFORE 'disappearance';--> statement-breakpoint
ALTER TYPE "public"."person_event_type" ADD VALUE 'education' BEFORE 'disappearance';--> statement-breakpoint
ALTER TYPE "public"."person_event_type" ADD VALUE 'work' BEFORE 'disappearance';--> statement-breakpoint
ALTER TABLE "person_event" ADD COLUMN "title" text;--> statement-breakpoint
UPDATE "person_event" SET "title" = CASE "type"::text
  WHEN 'birth' THEN 'Nacimiento' WHEN 'death' THEN 'Fallecimiento'
  WHEN 'disappearance' THEN 'Desaparición' WHEN 'last_contact' THEN 'Último contacto'
  WHEN 'found' THEN 'Hallazgo' ELSE 'Acontecimiento' END;--> statement-breakpoint
ALTER TABLE "person_event" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "person_event" ADD CONSTRAINT "person_event_title_nonempty" CHECK (length(btrim("person_event"."title")) > 0);
