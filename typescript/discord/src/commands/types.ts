import type { ChatInputCommandInteraction, Interaction, SharedSlashCommand } from "discord.js";

export type Command = {
  data: SharedSlashCommand;

  execute: (interaction: Interaction & { commandName: string }) => Promise<void>;
};
