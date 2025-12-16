// bot.js

// 🌟 Load environment variables from .env file
require('dotenv').config();

// 🔁 Run deploy-commands.js (optional)
require('./server');

// Helps Function
const { yunyun_fcn } = require('./commands/ignoreCmds/yunyun_fcn');

// ⚡ Import necessary Discord.js classes
const { Client, Collection, GatewayIntentBits } = require('discord.js');

// 📂 File system modules
const fs = require('fs');
const path = require('path');

// 🔁 Register slash commands
require('./deploy-commands');

// 🤖 Create Discord client with required intents
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 📝 Store commands here
client.commands = new Collection();

// 📦 Load all command files automatically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

// ⚡ When bot is ready
client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
});

// 💬 Slash command handler (Best Practice)
client.on('interactionCreate', async interaction => {

    /* ================= SLASH COMMAND ================= */
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
        }
        return; // ⬅️ IMPORTANT: stop here
    }

    /* ================= MODAL SUBMIT ================= */
    if (interaction.isModalSubmit()) {

        if (!interaction.isModalSubmit()) return;
        if (interaction.customId !== 'authTestModal') return;

        const password =
            interaction.fields.getTextInputValue('password');

        // ❌ WRONG PASSWORD
        if (password !== process.env.FCN_PASSWORD) {
            return interaction.reply({
                content: '❌ Wrong password',
                ephemeral: true,
            });
        }

        // ✅ PASSWORD OK → RUN FUNCTION
        await yunyun_fcn(interaction);
    }
});


// 🔑 Login to Discord
client.login(process.env.DISCORD_TOKEN);
