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
 * fetchWithTimeout(url, options, timeout, retries)
 * 
 * Perform a fetch request with timeout and optional retries.
 * Returns the raw Response object.
 *
 * @param {string} url - URL to fetch.
 * @param {object} options - Fetch options (method, headers, body, etc.).
 * @param {number} timeout - Maximum time in ms before aborting.
 * @param {number} retries - Number of retry attempts on failure.
 * @returns {Promise<Response>} - Returns the fetch Response object if successful.
 * @throws {Error} - Throws if all attempts fail or timeout occurs.
 ****************************************************************************************/
async function fetchWithTimeout(url, options = {}, timeout = 5000, retries = 3) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Optional: peek at content-type to warn if not JSON
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const clone = response.clone(); // clone so original can still be used
                const json = await clone.json();
                // simple check for empty data
                if (!json || (json.data && Array.isArray(json.data) && json.data.length === 1 && Object.keys(json.data[0]).length === 0)) {
                    throw new Error('Empty or malformed JSON data');
                }
            }

            return response; // success, return raw Response

        } catch (err) {
            clearTimeout(timeoutId);

            if (attempt <= retries) {
                // console.warn(`Attempt ${attempt} failed: ${err}. Retrying in 1s...`);
                await new Promise(res => setTimeout(res, 1000));
            } else {
                throw new Error(`Failed after ${retries + 1} attempts: ${err}`);
            }
        }
    }
}


/****************************************************************************************
 * 🎨 createEmbed(data)
 ****************************************************************************************/
function createEmbed({
    symbol = '',
    longName = '',
    thumbnailUrl = null,
    regularMarketPrice = '',
    currency = '',
    suggestion = '',
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
        .setAuthor({
            name: `${symbol} | ${longName}`,
            iconURL: thumbnailUrl,
        })
        .setTitle(symbol !== 'NULL' ? `>>> **${regularMarketPrice} ${currency}**` : 'NULL')
        .setColor(0x57f287)
        .addFields(
            {
                name: '▶ *Support Levels*',
                value: supportLevels.length > 0
                    ? "```\n" +
                    supportLevels.map((v, i) => {
                        const colors = ["🟩", "🟨", "🟧", "🟥"];
                        const color = colors[i % colors.length];
                        return `${color} ไม้ที่ ${i + 1}: ${v}`;
                    }).join("\n") +
                    "\n```"
                    : "```No data```",
                inline: false
            },
            {
                name: '▶ *SMA (TFD)*',
                value: smaDay.length > 0
                    ? `\`\`\`\n${smaDay.map((v, i) => `${[50, 100, 200][i]}D`.padEnd(6) + `: ${v}`).join('\n')}\n\`\`\``
                    : '```No data```',
                inline: false
            },
            {
                name: '▶ *SMA (TFW)*',
                value: smaWeek.length > 0
                    ? `\`\`\`\n${smaWeek.map((v, i) => `${[50, 100][i]}W`.padEnd(6) + `: ${v}`).join('\n')}\n\`\`\``
                    : '```No data```',
                inline: false
            },
            {
                name: '▶ *Notes*',
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
            const isEmpty = dataInfo && Object.keys(dataInfo).length === 0 && dataInfo.ticker;

            // console.log(dataInfo);

            if (!isEmpty) {
                embedsToSend = createEmbed({
                    symbol: dataInfo.ticker,
                    longName: dataInfo.longName,
                    thumbnailUrl: dataInfo.thumbnailUrl,
                    regularMarketPrice: dataInfo.regularMarketPrice,
                    currency: dataInfo.currency,
                    suggestion: dataInfo.suggestion,
                    supportLevels: dataInfo.supportLevels,
                    smaDay: dataInfo.smaDay,
                    smaWeek: dataInfo.smaWeek,
                    note: dataInfo.note
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
