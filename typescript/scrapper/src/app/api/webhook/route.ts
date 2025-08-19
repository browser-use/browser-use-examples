import { verifyWebhookEventSignature } from "browser-use-sdk/lib/webhooks.mjs";
import { eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import { ExhaustiveSwitchCheck } from "@/lib/types";
import { browseruse } from "@/lib/sdk";
import { zScrapperSchema } from "@/lib/prompt";

export async function POST(request: Request) {
  const body = await request.text();

  const signature = request.headers.get("x-browser-use-signature") as string;
  const timestamp = request.headers.get("x-browser-use-timestamp") as string;

  const event = await verifyWebhookEventSignature(
    {
      body,
      signature,
      timestamp,
    },
    {
      secret: process.env.SECRET_KEY!,
    }
  );

  if (event.ok) {
    switch (event.event.type) {
      case "test":
        break;
      case "agent.task.status_update": {
        if (event.event.payload.status !== "finished") {
          break;
        }

        const { task_id } = event.event.payload;

        const dbProfile = await db.query.profiles.findFirst({
          where: eq(schema.profiles.browserUseTaskId, task_id),
        });

        if (!dbProfile) {
          // NOTE: It's possible that we receive a webhook for a task
          //       this app isn't monitoring.
          break;
        }

        const buTask = await browseruse.tasks.retrieve({
          taskId: task_id,
          schema: zScrapperSchema,
        });

        if (!buTask) {
          throw new Error(`Task ${task_id} not found on BrowserUse Cloud!`);
        }

        const payload = buTask.doneOutput;

        if (!payload) {
          throw new Error(`Task ${task_id} has no output!`);
        }

        // NOTE: We use a transaction to ensure that the profile is updated
        //       and the data is inserted in a consistent state.
        await db.transaction(async (tx) => {
          await tx
            .update(schema.profiles)
            .set({
              residence: payload.residence,
              estimatedAgeMin: payload.estimated_age.min,
              estimatedAgeMax: payload.estimated_age.max,
              estimatedSalaryMin: payload.estimated_salary.min,
              estimatedSalaryMax: payload.estimated_salary.max,
              interests: payload.interests,
            })
            .where(eq(schema.profiles.id, dbProfile.id));

          for (const article of payload.articles) {
            await tx.insert(schema.profileArticles).values({
              profileId: dbProfile.id,
              title: article.title,
              url: article.url,
            });
          }

          for (const project of payload.projects) {
            await tx.insert(schema.profileProjects).values({
              profileId: dbProfile.id,
              name: project.name,
              url: project.url,
            });
          }

          for (const employment of payload.employments) {
            await tx.insert(schema.profileEmployments).values({
              profileId: dbProfile.id,
              company: employment.company,
              position: employment.position,
              startDate: employment.start_date,
              endDate: employment.end_date,
            });
          }

          for (const social of payload.socials) {
            await tx.insert(schema.profileSocials).values({
              profileId: dbProfile.id,
              url: social,
            });
          }

          await tx
            .update(schema.profiles)
            .set({ status: "completed" })
            .where(eq(schema.profiles.id, dbProfile.id));
        });

        break;
      }
      default:
        throw new ExhaustiveSwitchCheck(event.event);
    }
  }

  return new Response("OK");
}
