import { jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),

  input: text("input").notNull(),
  columns: jsonb("columns").notNull(),
});
