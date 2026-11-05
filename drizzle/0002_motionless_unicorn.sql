-- Preserve any existing 'other' records as 'union' while updating the available kinds.
ALTER TYPE "public"."partnership_kind" RENAME VALUE 'other' TO 'union';--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_pair_kind_start_unique" UNIQUE NULLS NOT DISTINCT("tree_id","person_a_id","person_b_id","kind","start_year","start_month","start_day");--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_dates_ordered" CHECK ((
      "partnership"."start_year" is null or "partnership"."end_year" is null
      or ("partnership"."end_year", coalesce("partnership"."end_month", 12), coalesce("partnership"."end_day", 31)) >=
         ("partnership"."start_year", coalesce("partnership"."start_month", 1), coalesce("partnership"."start_day", 1))
    ));
