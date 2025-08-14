import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  ToolSet,
  InferUITools,
  UIDataTypes,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { BrowserUse } from "browser-use-sdk";

// Allow streaming responses up to 5 minutes
export const maxDuration = 300;

const bu = new BrowserUse({
  apiKey: process.env.BROWSER_USE_API_KEY,
});

type TaskStatus =
  | {
      status: "starting";
      liveUrl: string | null;
    }
  | {
      status: "running";

      lastStep: BrowserUse.Tasks.TaskView.Step;
      liveUrl: string | null;
    }
  | {
      status: "done";

      output: string;
      liveUrl: string;

      sessionId: string;
    };

const tools = {
  runTask: tool({
    description: "Run a task in a web browser.",
    inputSchema: z.object({
      task: z.string(),
    }),
    async *execute({ task }, { abortSignal }) {
      // Create Task
      const rsp = await bu.tasks.create({ task: task });

      console.log(`[agent] Task created: ${rsp.id}`);

      poll: do {
        // Wait for Task to Finish
        const status = (await bu.tasks.retrieve(
          rsp.id,
          { statusOnly: false },
          { signal: abortSignal },
        )) as BrowserUse.Tasks.TaskView;

        console.log(`[agent] task status: ${status.status}`);

        switch (status.status) {
          case "started":
          case "paused":
          case "stopped":
            if (status.steps == null || status.steps.length === 0) {
              yield {
                status: "starting",
                liveUrl: status.sessionLiveUrl ? status.sessionLiveUrl : null,
              } satisfies TaskStatus;

              break;
            }

            const lastStep = status.steps[status.steps.length - 1];

            yield {
              status: "running",
              lastStep: lastStep,
              liveUrl: status.sessionLiveUrl ? status.sessionLiveUrl : null,
            } satisfies TaskStatus;

            await new Promise((resolve) => setTimeout(resolve, 1000));

            break;

          case "finished":
            if (status.sessionLiveUrl == null) {
              break;
            }

            yield {
              status: "done",
              output: status.doneOutput,
              liveUrl: status.sessionLiveUrl,
              sessionId: status.sessionId,
            } satisfies TaskStatus;

            break poll;

          default:
            throw new Error(`Unknown status: ${status.status}`);
        }
      } while (true);
    },
  }),
} satisfies ToolSet;

export type ChatTools = InferUITools<typeof tools>;

export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

// ROUTE

export async function POST(req: Request) {
  const { messages, model }: { messages: UIMessage[]; model: string } = await req.json();

  const result = streamText({
    model: model,
    messages: convertToModelMessages(messages),
    system:
      "You are a helpful assistant that can answer questions and help with tasks. You can use the tools provided to you to help you answer questions and help with tasks.",
    tools: tools,
    stopWhen: stepCountIs(15),
  });

  // send sources and reasoning back to the client
  return result.toUIMessageStreamResponse({
    sendSources: false,
    sendReasoning: false,
  });
}
