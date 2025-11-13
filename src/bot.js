require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

// 📦 โหลด commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// ⚡ Ready event
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// 💬 Interaction handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('⚠️ Error executing command:', error);
    await interaction.reply({ content: '❌ Error while executing command.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
