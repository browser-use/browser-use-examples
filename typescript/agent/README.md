# Browser Use Agent

> Create an agent that can Browse the Web using Browser Use.

<p align="center">
  <img src="media/app.png" alt="App Screenshot" height="400" />
</p>

## TLDR

### Integrating with Vercel AI SDK

> [`src/app/api/chat/route.ts`](./src/app/api/chat/route.ts)

```ts
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

      lastStep: BrowserUse.Tasks.TaskStepView;
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

      const res = await bu.tasks.create({ task }, { signal: abortSignal });

      const gen = bu.tasks.stream(res.id, { signal: abortSignal });

      for await (const event of gen) {
        const status = event.data;

        console.log(`[agent] task status: ${status.status}`);

        if (status.doneOutput) {
          console.log(`[agent] task output: ${status.doneOutput}`);
        }

        switch (status.status) {
          case "started":
          case "paused":
          case "stopped":
            if (status.steps == null || status.steps.length === 0) {
              yield {
                status: "starting",
                liveUrl: status.session.liveUrl ? status.session.liveUrl : null,
              } satisfies TaskStatus;

              break;
            }

            const lastStep = status.steps[status.steps.length - 1];

            yield {
              status: "running",
              lastStep: lastStep,
              liveUrl: status.session.liveUrl ? status.session.liveUrl : null,
            } satisfies TaskStatus;

            break;

          case "finished":
            if (status.session.liveUrl == null || status.doneOutput == null) {
              break;
            }

            yield {
              status: "done",
              output: status.doneOutput,
              liveUrl: status.session.liveUrl,
              sessionId: status.sessionId,
            } satisfies TaskStatus;

            break;

          default:
            throw new Error(`Unknown status: ${status.status}`);
        }
      }
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
```

### Integrating with Vercel AI Chat

> [`src/app/page.tsx`](./src/app/page.tsx).

```tsx
const { messages, sendMessage, status } = useChat<ChatMessage>({
  transport: new DefaultChatTransport({
    api: "/api/chat",
  }),
});
```

## Development Setup

```bash
# Install dependencies
pnpm i

# Start Dev
pnpm dev
```

### Getting Environment Variables

> Set up environment variables to successfully run this example locally.

- Vercel Gateway AI - [Get API Key](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys&title=Get%20your%20AI%20Gateway%20key)
- Browser Use Cloud API - [Get API Key](https://cloud.browser-use.com/billing)

Copy `.env.example` into `.env` and run the project!
