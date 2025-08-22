import { gtos } from "browser-use-sdk/lib/nextjs/server/utils";
import { eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import { zScrapperSchema } from "@/lib/prompt";
import { browseruse } from "@/lib/sdk";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (typeof id !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  const entry = await db.query.profiles.findFirst({
    where: eq(schema.profiles.id, id),
  });

  if (entry == null) {
    return new Response("Not found", { status: 404 });
  }

  // Create Task
  const gen = browseruse.tasks.stream({
    taskId: entry.browserUseTaskId,
    schema: zScrapperSchema,
  });

  const stream = gtos(gen, {});

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // avoid proxy buffering
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (typeof id !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  await db.delete(schema.profiles).where(eq(schema.profiles.id, id));

  return new Response("OK", { status: 200 });
}
