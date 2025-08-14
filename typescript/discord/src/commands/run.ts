import { BrowserUse } from "browser-use-sdk";
import { SlashCommandBuilder } from "discord.js";

import { ExhaustiveSwitchCheck } from "../lib/types";
import type { Command } from "./types";

const browseruse = new BrowserUse({
  apiKey: process.env.BROWSERUSE_API_KEY,
});

export const run: Command = {
  data: new SlashCommandBuilder()
    .setName("run")
    .setDescription("Run a task in the browser")
    .addStringOption((option) => option.setName("command").setDescription("The command to run").setRequired(true)),

  async execute(interaction) {
    const command = interaction.options.getString("command");

    if (command == null) {
      await interaction.reply("Please give me a task to automate!");
      return;
    }

    const tick: { current: number } = { current: 0 };

    const state: { current: BrowserState } = { current: null };

    poll: do {
      tick.current++;

      let status: BrowserUse.TaskView;

      // NOTE: We take action on each tick.
      if (state.current == null) {
        status = await browseruse.tasks.create({
          task: command,
          agentSettings: {
            llm: "o3",
          },
        });
      } else {
        status = (await browseruse.tasks.retrieve(state.current.taskId)) as BrowserUse.TaskView;
      }

      const [newState, events] = reducer(state.current, { kind: "status", status });

      for (const event of events) {
        switch (event.kind) {
          case "task_started":
            interaction.reply(`Browser Use Task started (${event.taskId})`);
            break;
          case "session_live_url_ready":
            interaction.followUp(`Watch live Browser Use session at ${event.liveUrl}`);
            break;
          case "task_step_completed":
            interaction.followUp(`[${event.step.url}] ${event.step.nextGoal}`);
            break;
          case "task_completed":
            interaction.followUp(event.output);
            break poll;
          default:
            throw new ExhaustiveSwitchCheck(event);
        }
      }

      state.current = newState;

      // LOGS

      if (state.current != null) {
        console.log(`${state.current.taskId} | [${tick.current}] ${status.status} `.padEnd(100, "-"));
        for (const event of events) {
          console.log(`${state.current.taskId} | - ${event.kind}`);
        }
      } else {
        // NOTE: This should never happen!
        throw new Error("Task unexpectedly got negative status update...");
      }

      // TIMER

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } while (true);

    if (state.current == null) {
      console.log(`TASK NOT STARTED`);
    } else {
      console.log(`${state.current.taskId} | [${tick.current}] DONE `.padEnd(100, "-"));
    }
  },
};

// Event Loop ----------------------------------------------------------------

type BrowserState = {
  taskId: string;
  sessionId: string;

  liveSessionUrl: string | null;

  steps: BrowserUse.TaskView.Step[];

  output: string | null;
} | null;

type BrowserAction = {
  kind: "status";
  status: BrowserUse.TaskView;
};

type ReducerEvent =
  | {
      kind: "task_started";
      taskId: string;
      sessionId: string;
    }
  | {
      kind: "session_live_url_ready";
      liveUrl: string;
    }
  | {
      kind: "task_step_completed";
      step: BrowserUse.TaskView.Step;
    }
  | {
      kind: "task_completed";
      output: string;
    };

function reducer(state: BrowserState, action: BrowserAction): [BrowserState, Array<ReducerEvent>] {
  switch (action.kind) {
    case "status": {
      if (state == null) {
        const liveUrl = action.status.sessionLiveUrl ?? null;

        const state: BrowserState = {
          taskId: action.status.id,
          sessionId: action.status.sessionId,
          liveSessionUrl: liveUrl,
          steps: [],
          output: null,
        };

        const events: Array<ReducerEvent> = [
          { kind: "task_started", taskId: action.status.id, sessionId: action.status.sessionId },
        ];

        if (liveUrl != null) {
          events.push({ kind: "session_live_url_ready", liveUrl });
        }

        return [state, events];
      }

      const events: Array<ReducerEvent> = [];

      const liveUrl = action.status.sessionLiveUrl ?? null;

      if (state.liveSessionUrl == null && liveUrl != null) {
        events.push({ kind: "session_live_url_ready", liveUrl });
      }

      const steps = state.steps;
      if (action.status.steps != null) {
        const newSteps = action.status.steps.slice(state.steps.length);

        for (const step of newSteps) {
          steps.push(step);
          events.push({ kind: "task_step_completed", step });
        }
      }

      const output = action.status.doneOutput && action.status.doneOutput.length > 0 ? action.status.doneOutput : null;

      if (state.output == null && output != null) {
        events.push({ kind: "task_completed", output });
      }

      const newState: BrowserState = {
        ...state,
        liveSessionUrl: liveUrl,
        steps: steps,
        output: output,
      };

      return [newState, events];
    }
    default:
      throw new ExhaustiveSwitchCheck(action.kind);
  }
}
