// bot.js

// 🌟 Load environment variables from .env file
require('dotenv').config();

// 🔁 Run deploy-commands.js
require('./server');

// ⚡ Import necessary Discord.js classes
const { Client, Collection, GatewayIntentBits } = require('discord.js');

// 📂 File system and path modules
const fs = require('fs');
const path = require('path');

// 🔁 Run server.js first to register slash commands
require('./deploy-commands');

// 🤖 Create a new Discord client instance with necessary intents
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 📝 Collection to store commands
client.commands = new Collection();

// 📦 Load all command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// 🔁 Add each command to the client's collection
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

// ⚡ Ready event — fires when the bot is logged in and ready
client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
});

// 💬 Interaction handler for slash commands
client.on('interactionCreate', async interaction => {
    // ✅ Only handle chat input commands
    if (!interaction.isChatInputCommand()) return;

    // 🔍 Get the corresponding command from collection
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        // 🚀 Execute the command
        await command.execute(interaction);
    } catch (error) {
        // ❌ Log errors and reply to user
        console.error('⚠️ Error executing command:', error);
        await interaction.reply({ content: '❌ Error while executing command.', ephemeral: true });
    }
});

// 🔑 Login to Discord with bot token
client.login(process.env.DISCORD_TOKEN);
