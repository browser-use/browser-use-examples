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
    async *execute({ task }) {
      // Create Task
      const rsp = await bu.tasks.create({ task: task });

      poll: do {
        // Wait for Task to Finish
        const status = (await bu.tasks.retrieve(rsp.id, { statusOnly: false })) as BrowserUse.Tasks.TaskView;

        switch (status.status) {
          case "started":
          case "paused":
          case "stopped":
            if (status.steps == null || status.steps.length === 0) {
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
  continueTask: tool({
    description: "Continue a task in a web browser.",
    inputSchema: z.object({
      sessionId: z.string(),
      task: z.string(),
    }),
    async *execute({ sessionId, task }) {
      // Create Task
      const rsp = await bu.tasks.create({ task: task, browserSettings: { sessionId: sessionId } });

      poll: do {
        // Wait for Task to Finish
        const status = (await bu.tasks.retrieve(rsp.id, { statusOnly: false })) as BrowserUse.Tasks.TaskView;

        switch (status.status) {
          case "started":
          case "paused":
          case "stopped":
            if (status.steps == null || status.steps.length === 0) {
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
  const { messages, model, webSearch }: { messages: UIMessage[]; model: string; webSearch: boolean } = await req.json();

  const result = streamText({
    model: webSearch ? "perplexity/sonar" : model,
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
