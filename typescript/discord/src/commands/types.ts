import type { ChatInputCommandInteraction, SharedSlashCommand } from "discord.js";

export type Command = {
  data: SharedSlashCommand;

  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};
