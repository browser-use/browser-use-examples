import { REST, type RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from "discord.js";

import { registry } from "./commands";

// Commands ------------------------------------------------------------------

async function sync(config: { clientId: string; token: string }) {
  const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

  for (const command of Object.values(registry)) {
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(config.token);

  try {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });

    console.log(`Successfully reloaded application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
}

// Environment ---------------------------------------------------------------

if (require.main === module) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const token = process.env.DISCORD_TOKEN;

  if (!clientId || !token) {
    throw new Error("Missing environment variables");
  }

  void sync({ clientId, token });
}
