import { relations } from "drizzle-orm";
import {
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  status: text("status", {
    enum: ["running", "completed", "failed"],
  }).notNull(),

  browserUseTaskId: text("browser_use_task_id").notNull().unique(),

  name: text("name").notNull(),

  interests: text("interests"),

  residence: text("residence"),

  estimatedAgeMin: integer("estimated_age_min"),
  estimatedAgeMax: integer("estimated_age_max"),

  estimatedSalaryMin: integer("estimated_salary_min"),
  estimatedSalaryMax: integer("estimated_salary_max"),
});

export const profileRelations = relations(profiles, ({ many }) => ({
  employments: many(profileEmployments),
  articles: many(profileArticles),
  projects: many(profileProjects),
  socials: many(profileSocials),
}));

export const profileArticles = pgTable("profile_article", {
  id: uuid("id").primaryKey().defaultRandom(),

  profileId: uuid("profile_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),

  title: text("title").notNull(),
  url: text("url").notNull(),
});
export const profileArticlesRelations = relations(
  profileArticles,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [profileArticles.profileId],
      references: [profiles.id],
    }),
  })
);

export const profileProjects = pgTable("profile_project", {
  id: uuid("id").primaryKey().defaultRandom(),

  profileId: uuid("profile_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),

  name: text("name").notNull(),
  url: text("url").notNull(),
});

export const profileProjectsRelations = relations(
  profileProjects,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [profileProjects.profileId],
      references: [profiles.id],
    }),
  })
);

export const profileEmployments = pgTable("profile_employment", {
  id: uuid("id").primaryKey().defaultRandom(),

  profileId: uuid("profile_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),

  company: text("company").notNull(),
  position: text("position").notNull(),

  startDate: date("start_date"),
  endDate: date("end_date"),
});

export const profileEmploymentsRelations = relations(
  profileEmployments,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [profileEmployments.profileId],
      references: [profiles.id],
    }),
  })
);

export const profileSocials = pgTable("profile_social", {
  id: uuid("id").primaryKey().defaultRandom(),

  profileId: uuid("profile_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),

  url: text("url").notNull(),
});

export const profileSocialsRelations = relations(profileSocials, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileSocials.profileId],
    references: [profiles.id],
  }),
}));
