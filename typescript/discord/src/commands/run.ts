import { BrowserUse } from "browser-use-sdk";
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

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
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = interaction.options.getString("command");

    if (command == null) {
      await interaction.reply("Please give me a task to automate!");
      return;
    }

    await interaction.reply("Browser Use on the job!");

    const res = await browseruse.tasks.create({
      task: command,
      agentSettings: {
        llm: "o3",
      },
    });

    const gen = browseruse.tasks.stream(res.id);

    for await (const event of gen) {
      const status = event.data;

      switch (status.status) {
        case "started":
        case "stopped":
        case "paused": {
          const liveUrl = status.session.liveUrl ?? "⏳ Waiting...";

          const description: string[] = [];

          description.push(`**Command:** ${command}`);
          description.push(`**Task ID:** ${status.id}`);

          description.push("");

          if (status.steps) {
            for (const step of status.steps) {
              description.push(`- [${step.url}] ${step.nextGoal}`);
            }
          } else {
            description.push("No steps yet");
          }

          if (status.doneOutput) {
            description.push("");
            description.push(status.doneOutput);
          }

          const embed = new EmbedBuilder()
            .setTitle("🤖 Browser Use Task")
            .setDescription(description.join("\n"))
            .setColor(0x0099ff)
            .addFields(
              { name: "Status", value: "🔄 Running...", inline: true },
              { name: "Live Session", value: liveUrl, inline: true },
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });

          break;
        }

        case "finished": {
          const output: string[] = [];

          output.push(`# Browser Use Task - ${status.id} ✅`);
          output.push(`## Task`);
          output.push(command);

          output.push("");

          output.push(`## Output`);
          output.push(status.doneOutput ?? "No output");

          await interaction.editReply({ content: output.join("\n"), embeds: [] });

          break;
        }
        default:
          throw new ExhaustiveSwitchCheck(status.status);
      }

      console.log(`[${status.id}] ${status.status}`);
    }
  },
};
