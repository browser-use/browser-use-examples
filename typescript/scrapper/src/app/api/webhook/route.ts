import { createWebhookSignature } from "browser-use-sdk/lib/webhooks.mjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import { ExhaustiveSwitchCheck } from "@/lib/types";
import { browseruse } from "@/lib/sdk";
import { zScrapperSchema } from "@/lib/prompt";

// Webhook event schema
const zWebhookEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("test"),
    timestamp: z.string(),
    payload: z.object({ test: z.literal("ok") }),
  }),
  z.object({
    type: z.literal("agent.task.status_update"),
    timestamp: z.string(),
    payload: z.object({
      session_id: z.string(),
      task_id: z.string(),
      status: z.enum(["started", "paused", "finished", "stopped", "initializing"]),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const signature = request.headers.get("x-browser-use-signature") as string;
    const timestamp = request.headers.get("x-browser-use-timestamp") as string;

    // Verify signature manually (SDK has a bug - it uses body.payload instead of body)
    const expectedSignature = createWebhookSignature({
      payload: body,
      timestamp: timestamp,
      secret: process.env.SECRET_KEY!,
    });

    if (signature !== expectedSignature) {
      return new Response("Signature verification failed", { status: 401 });
    }

    // Parse and validate the event
    const parseResult = zWebhookEvent.safeParse(body);
    if (!parseResult.success) {
      return new Response("Invalid event format", { status: 400 });
    }

    const event = parseResult.data;

    switch (event.type) {
      case "test":
        break;
      case "agent.task.status_update": {
        if (event.payload.status !== "finished") {
          break;
        }

        const { task_id } = event.payload;

        const dbProfile = await db.query.profiles.findFirst({
          where: eq(schema.profiles.browserUseTaskId, task_id),
        });

        if (!dbProfile) {
          break;
        }

        const buTask = await browseruse.tasks.retrieve({
          taskId: task_id,
          schema: zScrapperSchema,
        });

        if (!buTask) {
          await db
            .update(schema.profiles)
            .set({ status: "failed" })
            .where(eq(schema.profiles.id, dbProfile.id));
          throw new Error(`Task ${task_id} not found on BrowserUse Cloud!`);
        }

        // Try multiple ways to get the parsed output
        let payload = (buTask as any).parsed || buTask.parsedOutput;

        // If parsedOutput is null but output exists, try parsing it manually
        if (!payload && (buTask as any).output) {
          try {
            const outputStr = (buTask as any).output;
            // Parse the JSON string
            payload = zScrapperSchema.parse(JSON.parse(outputStr));
          } catch (parseError) {
            // Parsing failed, continue to check if payload is null below
          }
        }

        if (!payload) {
          await db
            .update(schema.profiles)
            .set({ status: "failed" })
            .where(eq(schema.profiles.id, dbProfile.id));

          // Don't throw - just mark as failed and continue
          break;
        }

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
        throw new ExhaustiveSwitchCheck(event);
    }

    return new Response("OK");
  } catch (error) {
    return new Response("Internal server error", { status: 500 });
  }
}
