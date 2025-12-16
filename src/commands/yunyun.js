const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

module.exports = {
    /**
     * Defines the command's data, including its name and description for Discord.
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('yunyun')
        .setDescription('🤩 Personal Protfolio of Yunyun'),

    /**
     * Executes the slash command, creating and displaying the modal to the user.
     *
     * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction object from Discord.
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        // --- 1. Construct the Modal Container ---
        const authModal = new ModalBuilder()
            // Set a unique identifier for later interaction handling (e.g., in modal submit listener)
            .setCustomId('authTestModal')
            .setTitle('System Authentication Required');

        // --- 2. Construct the Text Input Component ---
        const passwordInput = new TextInputBuilder()
            // Set the unique identifier for the input field to retrieve its value later
            .setCustomId('password')
            .setLabel('Please Enter Key')
            .setPlaceholder('e.g., UltraSecureP@ss2025')
            .setStyle(TextInputStyle.Short) // Use TextInputStyle.Paragraph for multi-line input
            .setRequired(true)

        // --- 3. Wrap the Input in an Action Row ---
        // Modals require text inputs to be placed inside an ActionRow.
        const firstActionRow = new ActionRowBuilder().addComponents(passwordInput);

        // --- 4. Add the Row(s) to the Modal ---
        authModal.addComponents(firstActionRow);

        // --- 5. Display the Modal to the User ---
        // This is a prompt, and the user's response will trigger a new interaction ('modalSubmit').
        await interaction.showModal(authModal);

        // The submission logic will be handled elsewhere, checking for customId 'authTestModal'.
    },
};