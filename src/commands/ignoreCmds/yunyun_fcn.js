/****************************************************************************************
 * 📊 Run Stock Table Logic (for Modal)
 ****************************************************************************************/

const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL_YUNYUN;
const FETCH_TIMEOUT = 10000;

// node-fetch (CommonJS safe)
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));

/* ---------------- FETCH WITH TIMEOUT ---------------- */
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    } finally {
        clearTimeout(id);
    }
}

/* ---------------- TABLE BUILD ---------------- */
function buildStockTable(stocks) {
    // Defines the fields, headers, and their formatting logic
    const fields = [
        { header: 'Stock', key: 'ticker', format: (v) => v },
        { header: 'Price', key: 'regularMarketPrice', format: (v) => Number(v).toFixed(2) },
        { header: 'S1', key: 'support1', format: (v) => v },
        { header: 'S2', key: 'support2', format: (v) => v },
        { header: 'S3', key: 'support3', format: (v) => v },
        { header: 'S4', key: 'support4', format: (v) => v },
        { header: 'Note', key: 'note', format: (v) => v },
    ];

    // The maximum length of the header strings ("Stock", "Price", etc.) for alignment.
    // Max length is 5 (from 'Stock'/'Price').
    const MAX_HEADER_LENGTH = fields.reduce((max, field) =>
        Math.max(max, field.header.length)
        , 0); // Result is 5

    // The required separator line from the user example
    const SEPARATOR = '\n=========================\n';

    const stockBlocks = stocks.map(stock => {
        const lines = fields.map(field => {
            let value = stock[field.key];

            // 1. Format the value
            value = field.format(value);

            // 2. Handle null, undefined, or empty values by replacing them with a hyphen '-'
            // This ensures consistent output like the user's example.
            const formattedValue = (value === null || value === undefined || value.toString().trim() === '') ? '-' : value.toString();

            // 3. Pad the header label to ensure the ':' aligns vertically
            const paddedHeader = field.header.padEnd(MAX_HEADER_LENGTH);

            // 4. Construct the final line, including the ' ▸ ' prefix and colon alignment
            return ` ▸ ${paddedHeader} : ${formattedValue}`;
        });

        // Join all field lines for this single stock
        return lines.join('\n');
    });

    // Join all stock blocks with the required separator, adding one at the start and end
    const result = SEPARATOR + stockBlocks.join(SEPARATOR) + SEPARATOR;

    // Wrap in the markdown code block
    return `\`\`\`\n${result}\n\`\`\``;
}

/* ---------------- EMBED ---------------- */
function createEmbedTable(stocks) {
    return [
        new EmbedBuilder()
            .setTitle('🤩 PERSONAL PORTFOLIO YUNYUN')
            .setColor(0xfc9003)
            .setDescription(buildStockTable(stocks))
    ];
}

/* ---------------- MAIN FUNCTION ---------------- */
async function yunyun_fcn(interaction) {
    // Fallback error embed
    const errorEmbed = new EmbedBuilder()
        .setTitle('❌ ERROR')
        .setDescription('Failed to fetch stock data')

    try {
        await interaction.deferReply(); // Avoid timeout

        // Prepare form data
        const formData = new URLSearchParams();
        formData.append('password', '');

        // Fetch stock info with timeout
        const response = await fetchWithTimeout(SCRIPT_URL, { method: 'POST', body: formData }, FETCH_TIMEOUT);
        // Check response
        if (!response.ok) throw new Error('Failed to fetch data');
        // Prepare
        const dataInfo = await response.json();
        let embedsToSend = [errorEmbed]; // default

        // Check error
        const isEmpty = dataInfo.data === undefined;

        if (!isEmpty) {
            embedsToSend = createEmbedTable(dataInfo.data);
        }

        await interaction.editReply({ embeds: embedsToSend });

    } catch (error) {
        console.dir(error, { depth: null, colors: true });

        // Send fallback error
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

module.exports = { yunyun_fcn };
