/****************************************************************************************
 * 📊 Discord Stock Command - Fetch Stock Data from Google Sheet via Apps Script
 * Author: (your name)
 * Description:
 *  - Fetches stock info from Google Sheet (via Apps Script endpoint)
 *  - Displays stock data using elegant embeds
 *  - Handles request timeout and API errors
 ****************************************************************************************/

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

// Node-fetch import for CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Timeout for fetch (ms)
const FETCH_TIMEOUT = 10000;

/****************************************************************************************
 * ⌛ fetchWithTimeout(url, options, timeout, retries)
 * 
 * Perform a fetch request with a timeout and optional retry mechanism.
 * If the request exceeds the timeout, it will be aborted.
 * If the request fails or response is not OK, it can retry a specified number of times.
 * 
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options (method, headers, body, etc.).
 * @param {number} timeout - Maximum time in milliseconds before aborting the request.
 * @param {number} retries - Number of retry attempts on failure.
 * @returns {Promise<Response>} - Returns a fetch Response object if successful.
 * @throws {Error} - Throws an error if all attempts fail or timeout occurs.
 ****************************************************************************************/
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT, retries = 5) {
    // Loop through attempts, including retries
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        // Create AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            // Perform fetch with abort signal
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId); // Clear timeout if fetch succeeds

            // Check if response is OK (status code 2xx)
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
            }

            // Return the successful response
            return response;

        } catch (error) {
            clearTimeout(timeoutId); // Clear timeout on error

            // If retries remain, wait 1000ms and retry
            if (attempt <= retries) {
                await new Promise(res => setTimeout(res, 1000));
            } else {
                // No retries left, throw the error
                throw error;
            }
        }
    }
}


/****************************************************************************************
 * 🎨 createEmbed(data)
 ****************************************************************************************/
function createEmbed({
    symbol = 'NULL',
    thumbnailUrl = null,
    currentPrice = 'No data',
    suggestion = 'No data',
    supportLevels = [],
    smaDay = [],
    smaWeek = [],
    note = []
}) {
    // Ensure arrays
    supportLevels = Array.isArray(supportLevels) ? supportLevels : [];
    smaDay = Array.isArray(smaDay) ? smaDay : [];
    smaWeek = Array.isArray(smaWeek) ? smaWeek : [];
    note = Array.isArray(note) ? note : [];

    const embed = new EmbedBuilder()
        .setTitle(symbol !== 'NULL' ? `> Stock Alert: ***${symbol}***` : 'Stock Alert')
        .setDescription('——————————')
        .setColor(0x57f287)
        .setThumbnail(thumbnailUrl || '')
        .addFields(
            {
                name: '💰 Current Price',
                value: `\`\`\`\n${currentPrice}\n\`\`\``,
                inline: false
            },
            {
                name: '🎯 Support Levels',
                value: supportLevels.length > 0
                    ? `\`\`\`\n${supportLevels.map((v, i) => `ไม้ที่ ${i + 1}: ${v}`).join('\n')}\n\`\`\``
                    : '```No data```',
                inline: false
            },
            {
                name: '📅 SMA (TFD)',
                value: smaDay.length > 0
                    ? `\`\`\`\n${smaDay.map((v, i) => `${[50, 100, 200][i]}D`.padEnd(6) + `: ${v}`).join('\n')}\n\`\`\``
                    : '```No data```',
                inline: false
            },
            {
                name: '📅 SMA (TFW)',
                value: smaWeek.length > 0
                    ? `\`\`\`\n${smaWeek.map((v, i) => `${[50, 100][i]}W`.padEnd(6) + `: ${v}`).join('\n')}\n\`\`\``
                    : '```No data```',
                inline: false
            },
            {
                name: '📝 Notes',
                value: note.length > 0 ? `\`\`\`\n${note[0]}\n\`\`\`` : '```No data```',
                inline: false
            }
        )

    return [embed];
}

/****************************************************************************************
 * ⚙️ Discord Slash Command: /stock
 ****************************************************************************************/
module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Get stock info from Google Sheet')
        .addStringOption(option =>
            option.setName('ticker')
                .setDescription('Stock ticker, e.g., NVDA')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply(); // Avoid timeout

        const symbol = interaction.options.getString('ticker').toUpperCase();

        // Fallback error embed
        const errorEmbed = new EmbedBuilder()
            .setTitle('***Unable to Fetch Stock Data***')
            .setDescription(`### > ${symbol}\nThe requested stock information is currently unavailable.`)
            .addFields({
                name: '▸ Possible Reasons',
                value: '```・No stock in Google Sheet\n・Invalid symbol or ticker\n・API rate limit reached\n・Request timeout```',
                inline: false
            })

        try {
            // Prepare form data
            const formData = new URLSearchParams();
            formData.append('ticker', symbol);

            // Fetch with timeout
            const response = await fetchWithTimeout(SCRIPT_URL, { method: 'POST', body: formData }, FETCH_TIMEOUT);

            if (!response.ok) throw new Error('Failed to fetch data');

            const dataInfo = await response.json();

            let embedsToSend = [errorEmbed]; // default

            if (dataInfo.data && Array.isArray(dataInfo.data) && dataInfo.data.length > 0 && dataInfo.data[0]) {
                embedsToSend = createEmbed({
                    symbol: dataInfo.data[0].ticker,
                    thumbnailUrl: dataInfo.data[0].thumbnailUrl,
                    currentPrice: dataInfo.data[0].currentPrice,
                    suggestion: dataInfo.data[0].suggestion,
                    supportLevels: dataInfo.data[0].supportLevels,
                    smaDay: dataInfo.data[0].smaDay,
                    smaWeek: dataInfo.data[0].smaWeek,
                    note: dataInfo.data[0].note
                });
            }

            await interaction.editReply({ embeds: embedsToSend });

        } catch (error) {
            // console.dir(error, { depth: null, colors: true });

            // Send fallback error
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
