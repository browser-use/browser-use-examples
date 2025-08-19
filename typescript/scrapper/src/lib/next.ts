import { TaskViewWithSchema } from "browser-use-sdk/lib/parse.js";
import { ZodType } from "zod";

export type BrowserUseEvent<T extends ZodType = ZodType> = {
  event: "status";
  data: TaskViewWithSchema<T>;
};

/**
 * Convert an async generator to a stream.
 *
 * @param gen - The async generator to convert to a stream.
 * @returns A stream of the async generator.
 */
export function gtos(
  gen: AsyncGenerator<{
    event: "status";
    data: TaskViewWithSchema<ZodType>;
  }>,
  opts?: {
    /**
     * Called when an event is emitted.
     */
    onEvent?: (event: TaskViewWithSchema<ZodType>) => void;

    /**
     * Called when the task is finished.
     */
    onFinished?: (event: TaskViewWithSchema<ZodType>) => void;
  }
): ReadableStream<Uint8Array<ArrayBufferLike>> {
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // open the SSE stream quickly
      controller.enqueue(enc.encode(": connected\n\n"));

      try {
        for await (const msg of gen) {
          opts?.onEvent?.(msg.data);

          const data: BrowserUseEvent = {
            event: msg.event,
            data: msg.data,
          };

          const encoded = JSON.stringify(data);

          const payload = `event: ${msg.event}\ndata: ${encoded}\n\n`;
          controller.enqueue(enc.encode(payload));

          if (msg.data.status === "finished") {
            opts?.onFinished?.(msg.data);
          }
        }

        controller.enqueue(enc.encode("event: end\ndata: {}\n\n"));
      } catch (e) {
        controller.enqueue(
          enc.encode(
            `event: error\ndata: ${JSON.stringify({ message: String(e) })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}
