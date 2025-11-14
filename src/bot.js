// bot.js

// 🌟 Load environment variables from .env file
require('dotenv').config();

// 🔁 Run deploy-commands.js (optional)
require('./server');

// ⚡ Import necessary Discord.js classes
const { Client, Collection, GatewayIntentBits, EmbedBuilder } = require('discord.js');

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
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);

    } catch (error) {
        console.error(`❌ Error executing /${interaction.commandName}:`, error);

        // Fallback: Error embed
        const errorEmbed = new EmbedBuilder()
            .setTitle('***Unable to Execute Command***')
            .setDescription(`The command **/${interaction.commandName}** could not be completed.`)
            .addFields({
                name: '▸ Possible Reasons',
                value: '```• Internal error\n• API or data source unavailable\n• Invalid input or symbol\n• Request timeout```',
                inline: false
            })
            .setColor(0xFF6B6B)
            .setFooter({ text: 'Discord Bot Error' })
            .setTimestamp();

        // Check if interaction already replied or deferred
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
});

// 🔑 Login to Discord
client.login(process.env.DISCORD_TOKEN);
