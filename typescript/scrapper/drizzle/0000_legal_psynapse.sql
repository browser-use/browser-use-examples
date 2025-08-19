CREATE TABLE "profile_article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_employment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"company" text NOT NULL,
	"position" text NOT NULL,
	"start_date" date,
	"end_date" date
);
--> statement-breakpoint
CREATE TABLE "profile_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_social" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"browser_use_task_id" text NOT NULL,
	"name" text NOT NULL,
	"interests" text,
	"residence" text,
	"estimated_age_min" integer,
	"estimated_age_max" integer,
	"estimated_salary_min" integer,
	"estimated_salary_max" integer,
	CONSTRAINT "profile_browser_use_task_id_unique" UNIQUE("browser_use_task_id")
);
--> statement-breakpoint
ALTER TABLE "profile_article" ADD CONSTRAINT "profile_article_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_employment" ADD CONSTRAINT "profile_employment_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_project" ADD CONSTRAINT "profile_project_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_social" ADD CONSTRAINT "profile_social_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;