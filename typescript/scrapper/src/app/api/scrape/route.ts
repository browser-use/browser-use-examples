import { NextRequest, NextResponse } from "next/server";
import z from "zod";

import { db } from "@/lib/db";
import { getAgentPrompt, zScrapperSchema } from "@/lib/prompt";
import { browseruse } from "@/lib/sdk";
import * as schema from "../../../db/schema";

// Allow streaming responses up to 1 minutes
export const maxDuration = 1 * 60;

//

const zPostSchema = z.object({
  name: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { name } = zPostSchema.parse(body);

  const task = await browseruse.tasks.create({
    task: getAgentPrompt(name),
    schema: zScrapperSchema,
  });

  const [entry] = await db
    .insert(schema.profiles)
    .values({ name, browserUseTaskId: task.id, status: "running" })
    .returning({ id: schema.profiles.id });

  return NextResponse.json({ id: entry.id });
}
