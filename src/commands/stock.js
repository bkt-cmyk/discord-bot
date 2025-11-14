/****************************************************************************************
 * 📊 Discord Stock Command - Fetch Stock Data from Google Sheet via Apps Script
 * Author: (your name)
 * Description:
 *  - This command fetches stock information from a Google Sheet (via Apps Script endpoint)
 *  - Displays stock data using an embedded message
 *  - Handles request timeout and API error gracefully
 ****************************************************************************************/

// 🧩 Import Dependencies
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// ⏱️ Timeout Configuration (in milliseconds)
const FETCH_TIMEOUT = 10000; // 10 seconds


/****************************************************************************************
 * ⌛ fetchWithTimeout(url, options, timeout)
 * - Custom fetch wrapper that cancels the request if it exceeds the given timeout
 ****************************************************************************************/
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}


/****************************************************************************************
 * 🎨 createEmbed(data)
 * - Create an elegant embed message for stock information
 ****************************************************************************************/
function createEmbed({
    symbol = 'NULL',
    thumbnailUrl = 'NULL',
    currentPrice = 'NULL',
    suggestion = 'NULL',
    supportLevels = 'NULL',
    smaDay = 'NULL',
    smaWeek = 'NULL',
    note = 'NULL'
}) {
    const embed1 = new EmbedBuilder()
        .setTitle(`> Stock Alert: ***${symbol}***`)
        .setDescription(`——————————`)
        .setColor(0x57f287)
        .setThumbnail(thumbnailUrl)
        .addFields(
            // 💰 Current price section
            {
                name: '💰 Current Price',
                value: `\`\`\`\n${currentPrice} (${suggestion})\n\`\`\``,
                inline: false
            },

            // 🎯 Support levels section
            {
                name: '🎯 Support Level',
                value: supportLevels.length > 0
                    ? `\`\`\`\n${supportLevels.map((v, i) => `ไม้ที่ ${i + 1} : ${v}`).join('\n')}\n\`\`\``
                    : '```ไม่มีข้อมูล```',
                inline: false
            },

            // 📅 SMA (TWD)
            {
                name: '📅 SMA (TFD)',
                value: smaDay.length > 0
                    ? `\`\`\`\n${smaDay.map((v, i) => `${[50, 100, 200][i]}D`.padEnd(6) + `: ${v}`).join('\n')}\n\`\`\``
                    : '```ไม่มีข้อมูล```',
                inline: false
            },

            // 📅 SMA (TFW)
            {
                name: '📅 SMA (TFW)',
                value: smaWeek.length > 0
                    ? `\`\`\`\n${smaWeek.map((v, i) => `${[50, 100][i]}W`.padEnd(6) + `: ${v}`).join('\n')}\n\`\`\``
                    : '```ไม่มีข้อมูล```',
                inline: false
            },

            // 📝 Note section
            {
                name: '📝 Note',
                value: note.length > 0 ? `\`\`\`\n${note[0]}\n\`\`\`` : '```ไม่มีข้อมูล```',
                inline: false
            }
        )
        .setFooter({ text: 'ข้อมูลจาก Google Sheets' })
        .setTimestamp();

    return [embed1];
}


/****************************************************************************************
 * ⚙️ Discord Slash Command: /stock
 * - Fetches data from Google Sheets (Apps Script)
 * - Displays it in an embed format
 ****************************************************************************************/
module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Get stock info from Google Sheet')
        .addStringOption(option =>
            option
                .setName('ticker')
                .setDescription('Stock ticker, e.g., NVDA')
                .setRequired(true)
        ),

    // 🎬 Main execution logic
    async execute(interaction) {
        await interaction.deferReply(); // Avoid interaction timeout while fetching

        const symbol = interaction.options.getString('ticker').toUpperCase();

        // 🔴 Error embed (used for fallback)
        const errorEmbed = new EmbedBuilder()
            .setTitle('***Unable to Fetch Stock Data***')
            .setDescription(`### > ${symbol}\nThe requested stock information is currently unavailable.`)
            .addFields({
                name: '▸ Possible Reasons',
                value: '```・No stock in Google Sheet\n・Invalid symbol or ticker\n・API rate limit reached\n・Request timeout (>10s)```',
                inline: false
            })
            .setColor(0xFF6B6B)
            .setTimestamp();

        try {
            // 📨 Prepare form data for POST
            const formData = new URLSearchParams();
            formData.append('ticker', symbol);

            // 🚀 Fetch data with timeout protection
            const response = await fetchWithTimeout(SCRIPT_URL, {
                method: 'POST',
                body: formData
            }, FETCH_TIMEOUT);

            // ❗ Throw error if failed
            if (!response.ok) throw new Error('Failed to fetch data');

            // 📦 Parse JSON response
            const dataInfo = await response.json();

            let embed = null;

            // ✅ If valid data returned
            if (dataInfo.data && dataInfo.data.length > 0 && dataInfo.data[0]) {
                embed = createEmbed({
                    symbol: dataInfo.data[0].ticker,
                    thumbnailUrl: dataInfo.data[0].thumbnailUrl,
                    currentPrice: dataInfo.data[0].currentPrice,
                    suggestion: dataInfo.data[0].suggestion,
                    supportLevels: dataInfo.data[0].supportLevels,
                    smaDay: dataInfo.data[0].smaDay,
                    smaWeek: dataInfo.data[0].smaWeek,
                    note: dataInfo.data[0].note
                });
            } else {
                // 🚫 No valid data found
                embed = errorEmbed;
            }

            // 💬 Send the embed to user
            await interaction.editReply({ embeds: embed });
            // await interaction.editReply({ embeds: [embed, embed] });

        } catch (error) {
            // ⚠️ Catch any fetch or timeout errors
            // console.error('Stock fetch error:', error.message);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

