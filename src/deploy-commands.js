// 🌟 Load environment variables from .env file
require('dotenv').config();

// ⚡ Import necessary Discord.js classes
const { REST, Routes } = require('discord.js');

// 📂 File system and path modules
const fs = require('fs');
const path = require('path');

// 🔑 Destructure environment variables
const { DISCORD_TOKEN, CLIENT_ID } = process.env;
const GUILD_ID = process.env.GUILD_ID
  ? process.env.GUILD_ID.split(',').map(id => id.trim())
  : [];

// 📝 Array to store command data
const commands = [];

// 📁 Path to the commands folder
const commandsPath = path.join(__dirname, 'commands');

// 📄 Read all .js files from commands folder
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// 🔁 Load and push each command's JSON data into the commands array
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

// 🌐 Initialize REST client for Discord API
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

// 🚀 Immediately invoked async function to register commands
(async () => {
  try {
    console.log('🔄 Registering application (/) commands...');

    // ⬆️ Register all commands for a specific guild
    for (const guildId of GUILD_ID) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(CLIENT_ID, guildId),
          { body: commands }
        );
      }
      catch (error) {
        // console.error('❌ Error registering commands:', error);
      }
    }

    console.log('✅ Successfully registered!');
  } catch (error) {
    // ❌ Log any errors during registration
    console.error('❌ Error registering commands:', error);
  }
})();
