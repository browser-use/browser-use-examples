import type { BrowserUseEvent } from "@/lib/next";
import { TaskViewWithSchema } from "browser-use-sdk/lib/parse.js";
import { useEffect, useState } from "react";
import type { ZodType } from "zod";

export function useBrowserUse<T extends ZodType = ZodType>(
  route: string
): TaskViewWithSchema<T> | null {
  const [status, setStatus] = useState<TaskViewWithSchema<T> | null>(null);

  useEffect(() => {
    const es = new EventSource(route);

    es.addEventListener("status", (e) => {
      const msg = JSON.parse(e.data) as BrowserUseEvent<T>;

      setStatus(msg.data);

      if (msg.data.status === "finished") {
        es.close();
      }
    });

    es.addEventListener("end", () => es.close());
    es.addEventListener("error", () => es.close());

    return () => es.close();
  }, [route]);

  return status;
}
