import { Client, Events, GatewayIntentBits } from "discord.js";
import { registry } from "./commands";

// Environment ---------------------------------------------------------------

const token = process.env.DISCORD_TOKEN;

// Client --------------------------------------------------------------------

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }

  const command = registry[interaction.commandName];

  if (!command) {
    console.error(`No command "${interaction.commandName}" was found...`);
    return;
  }

  await command.execute(interaction);
});

// Start ---------------------------------------------------------------------

if (require.main === module) {
  void client.login(token).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
