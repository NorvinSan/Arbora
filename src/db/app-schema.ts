import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./schema";

export const lifeStatus = pgEnum("life_status", ["living", "deceased", "unknown"]);
export const whereaboutsStatus = pgEnum("whereabouts_status", ["known", "missing", "unknown"]);
export const parentRelationType = pgEnum("parent_relation_type", ["biological", "adoptive", "other"]);
export const partnershipKind = pgEnum("partnership_kind", ["marriage", "partnership", "other"]);
export const eventType = pgEnum("person_event_type", [
  "birth", "death", "disappearance", "last_contact", "found", "other",
]);
export const dateQualifier = pgEnum("date_qualifier", ["exact", "approximate", "before", "after"]);
export const collaboratorRole = pgEnum("collaborator_role", ["editor", "viewer"]);

// "Exact" means exact to the supplied granularity: 1890 may be an exact year
// without an exact month or day. A qualifier is required whenever a year exists.
function partialDateIsValid(
  year: AnyPgColumn,
  month: AnyPgColumn,
  day: AnyPgColumn,
  qualifier: AnyPgColumn,
) {
  return sql`(
    (${year} is null and ${month} is null and ${day} is null and ${qualifier} is null)
    or (
      ${year} is not null
      and
      ${year} between 1 and 9999
      and ${qualifier} is not null
      and (${month} is null or ${month} between 1 and 12)
      and (${day} is null or (${month} is not null and ${day} between 1 and 31))
      and case
        when ${month} between 1 and 12 and ${day} is not null
          then ${day} <= extract(day from (make_date(${year}, ${month}, 1) + interval '1 month - 1 day'))
        else true
      end
    )
  )`;
}

export const familyTree = pgTable(
  "family_tree",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("family_tree_owner_idx").on(table.ownerId),
    check("family_tree_name_nonempty", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const person = pgTable(
  "person",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id").notNull().references(() => familyTree.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    givenName: text("given_name"),
    familyName: text("family_name"),
    preferredName: text("preferred_name"),
    biography: text("biography"),
    lifeStatus: lifeStatus("life_status").default("unknown").notNull(),
    whereaboutsStatus: whereaboutsStatus("whereabouts_status").default("unknown").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    unique("person_tree_id_id_unique").on(table.treeId, table.id),
    index("person_tree_name_idx").on(table.treeId, table.familyName, table.givenName),
    index("person_tree_display_name_idx").on(table.treeId, table.displayName),
    check("person_display_name_nonempty", sql`length(btrim(${table.displayName})) > 0`),
  ],
);

export const parentChild = pgTable(
  "parent_child",
  {
    treeId: uuid("tree_id").notNull().references(() => familyTree.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").notNull(),
    childId: uuid("child_id").notNull(),
    relationType: parentRelationType("relation_type").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.treeId, table.parentId, table.childId] }),
    foreignKey({ columns: [table.treeId, table.parentId], foreignColumns: [person.treeId, person.id] }).onDelete("cascade"),
    foreignKey({ columns: [table.treeId, table.childId], foreignColumns: [person.treeId, person.id] }).onDelete("cascade"),
    index("parent_child_child_idx").on(table.treeId, table.childId),
    check("parent_child_no_self", sql`${table.parentId} <> ${table.childId}`),
  ],
);

export const partnership = pgTable(
  "partnership",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id").notNull().references(() => familyTree.id, { onDelete: "cascade" }),
    personAId: uuid("person_a_id").notNull(),
    personBId: uuid("person_b_id").notNull(),
    kind: partnershipKind("kind").notNull(),
    startYear: integer("start_year"),
    startMonth: integer("start_month"),
    startDay: integer("start_day"),
    startQualifier: dateQualifier("start_qualifier"),
    endYear: integer("end_year"),
    endMonth: integer("end_month"),
    endDay: integer("end_day"),
    endQualifier: dateQualifier("end_qualifier"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.treeId, table.personAId], foreignColumns: [person.treeId, person.id] }).onDelete("cascade"),
    foreignKey({ columns: [table.treeId, table.personBId], foreignColumns: [person.treeId, person.id] }).onDelete("cascade"),
    index("partnership_person_a_idx").on(table.treeId, table.personAId),
    index("partnership_person_b_idx").on(table.treeId, table.personBId),
    check("partnership_canonical_pair", sql`${table.personAId} < ${table.personBId}`),
    check("partnership_start_date_valid", partialDateIsValid(table.startYear, table.startMonth, table.startDay, table.startQualifier)),
    check("partnership_end_date_valid", partialDateIsValid(table.endYear, table.endMonth, table.endDay, table.endQualifier)),
  ],
);

export const personEvent = pgTable(
  "person_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id").notNull().references(() => familyTree.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull(),
    type: eventType("type").notNull(),
    year: integer("year"),
    month: integer("month"),
    day: integer("day"),
    qualifier: dateQualifier("qualifier"),
    place: text("place"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.treeId, table.personId], foreignColumns: [person.treeId, person.id] }).onDelete("cascade"),
    index("person_event_person_idx").on(table.treeId, table.personId, table.type),
    uniqueIndex("person_event_one_birth_idx").on(table.treeId, table.personId).where(sql`${table.type} = 'birth'`),
    uniqueIndex("person_event_one_death_idx").on(table.treeId, table.personId).where(sql`${table.type} = 'death'`),
    check("person_event_date_valid", partialDateIsValid(table.year, table.month, table.day, table.qualifier)),
  ],
);

export const familyStory = pgTable(
  "family_story",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id").notNull().references(() => familyTree.id, { onDelete: "cascade" }),
    personId: uuid("person_id"),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    // Stories about a person are removed with that person; tree-wide stories remain.
    foreignKey({ columns: [table.treeId, table.personId], foreignColumns: [person.treeId, person.id] }).onDelete("cascade"),
    index("family_story_tree_person_idx").on(table.treeId, table.personId),
    check("family_story_title_nonempty", sql`length(btrim(${table.title})) > 0`),
  ],
);

export const treeCollaborator = pgTable(
  "tree_collaborator",
  {
    treeId: uuid("tree_id").notNull().references(() => familyTree.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: collaboratorRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.treeId, table.userId] }),
    index("tree_collaborator_user_idx").on(table.userId),
  ],
);

export const familyTreeRelations = relations(familyTree, ({ one, many }) => ({
  owner: one(user, { fields: [familyTree.ownerId], references: [user.id] }),
  people: many(person),
  partnerships: many(partnership),
  events: many(personEvent),
  stories: many(familyStory),
  collaborators: many(treeCollaborator),
}));

export const personRelations = relations(person, ({ one, many }) => ({
  tree: one(familyTree, { fields: [person.treeId], references: [familyTree.id] }),
  children: many(parentChild, { relationName: "parent_link" }),
  parents: many(parentChild, { relationName: "child_link" }),
  partnershipsAsA: many(partnership, { relationName: "partner_a" }),
  partnershipsAsB: many(partnership, { relationName: "partner_b" }),
  events: many(personEvent),
  stories: many(familyStory),
}));

export const parentChildRelations = relations(parentChild, ({ one }) => ({
  parent: one(person, { fields: [parentChild.parentId], references: [person.id], relationName: "parent_link" }),
  child: one(person, { fields: [parentChild.childId], references: [person.id], relationName: "child_link" }),
}));

export const partnershipRelations = relations(partnership, ({ one }) => ({
  tree: one(familyTree, { fields: [partnership.treeId], references: [familyTree.id] }),
  personA: one(person, { fields: [partnership.personAId], references: [person.id], relationName: "partner_a" }),
  personB: one(person, { fields: [partnership.personBId], references: [person.id], relationName: "partner_b" }),
}));

export const personEventRelations = relations(personEvent, ({ one }) => ({
  tree: one(familyTree, { fields: [personEvent.treeId], references: [familyTree.id] }),
  person: one(person, { fields: [personEvent.personId], references: [person.id] }),
}));

export const familyStoryRelations = relations(familyStory, ({ one }) => ({
  tree: one(familyTree, { fields: [familyStory.treeId], references: [familyTree.id] }),
  person: one(person, { fields: [familyStory.personId], references: [person.id] }),
  author: one(user, { fields: [familyStory.authorId], references: [user.id] }),
}));

export const treeCollaboratorRelations = relations(treeCollaborator, ({ one }) => ({
  tree: one(familyTree, { fields: [treeCollaborator.treeId], references: [familyTree.id] }),
  user: one(user, { fields: [treeCollaborator.userId], references: [user.id] }),
}));
