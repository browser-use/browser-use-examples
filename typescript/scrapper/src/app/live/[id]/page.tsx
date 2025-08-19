"use client";

import { TaskViewWithSchema } from "browser-use-sdk/lib/parse.mjs";
import { useParams } from "next/navigation";

import { useBrowserUse } from "@/hooks/useBrowserUse";
import { ScrapperSchemaZod } from "@/lib/prompt";

export default function LivePage() {
  const { id } = useParams();

  const live = useBrowserUse<ScrapperSchemaZod>(`/api/scrape/${id}`);

  if (!live) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
      {/* Live Browser */}
      <div className="col-span-1 w-full h-full overflow-hidden border-r border-dashed border-stone-400">
        {live.session.liveUrl ? (
          <iframe
            src={live.session.liveUrl}
            className="w-full h-full border border-transparent"
            title="Live browser preview"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <p>Waiting for browser activity...</p>
          </div>
        )}
      </div>

      {/* Step List */}
      <div className="col-span-1 w-full h-full overflow-hidden flex flex-col">
        <div className="w-full flex-none border-b border-dashed border-stone-400 px-6 py-2">
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span>ID: {live.id?.slice(0, 8)}...</span>
            <span>Status: {live.status}</span>
            <span>LLM: {live.llm}</span>
            {live.startedAt && (
              <span>
                Started: {new Date(live.startedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 w-full overflow-y-auto">
          {live.steps?.map((step) => (
            <StepItem key={step.number} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a single step of the live session.
 */
function StepItem({
  step,
}: {
  step: TaskViewWithSchema<ScrapperSchemaZod>["steps"][number];
}) {
  return (
    <div className="border-t border-dashed border-stone-400 p-6 first:border-t-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 text-sm flex items-center justify-center font-mono rounded border border-stone-400">
            {step.number}
          </div>
          <span className="font-semibold text-base">Step {step.number}</span>
        </div>
        {step.screenshotUrl && (
          <a
            href={step.screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:text-orange-700 text-xs px-3 py-1 border border-orange-400 transition-colors rounded"
          >
            Screenshot
          </a>
        )}
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <span className="text-gray-700 font-medium">Memory:</span>
          <p className="mt-1">{step.memory}</p>
        </div>

        <div>
          <span className="text-gray-700 font-medium">
            Previous Goal Evaluation:
          </span>
          <p className="mt-1">{step.evaluationPreviousGoal}</p>
        </div>

        <div>
          <span className="text-gray-700 font-medium">Next Goal:</span>
          <p className="mt-1">{step.nextGoal}</p>
        </div>

        <div>
          <span className="text-gray-700 font-medium">URL:</span>
          <p className="mt-1 truncate">{step.url}</p>
        </div>

        {step.actions.length > 0 && (
          <div>
            <span className="text-gray-700 font-medium">Actions:</span>
            <div className="mt-1 space-y-1">
              {step.actions.map((action, index) => (
                <pre
                  key={index}
                  className="bg-gray-900 p-2 text-xs font-mono text-gray-200 break-all rounded w-full overflow-x-auto"
                >
                  {formatJSON(action)}
                </pre>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatJSON(raw: string) {
  try {
    const json = JSON.parse(raw);
    return JSON.stringify(json, null, 2);
  } catch {
    return raw;
  }
}
