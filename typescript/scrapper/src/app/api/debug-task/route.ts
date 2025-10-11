import { NextRequest, NextResponse } from "next/server";
import { browseruse } from "@/lib/sdk";
import { zScrapperSchema } from "@/lib/prompt";

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  try {
    const task = await browseruse.tasks.retrieve({
      taskId,
      schema: zScrapperSchema,
    });

    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      isSuccess: task.isSuccess,
      doneOutput: task.doneOutput,
      parsedOutput: task.parsedOutput,
      session: task.session,
      llm: task.llm,
      steps: task.steps.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch task", details: String(error) },
      { status: 500 }
    );
  }
}
