/****************************************************************************************
 * 📊 Discord Stock Command - Fetch Stock Data from Google Sheet via Apps Script
 * Author: (your name)
 * Description:
 *  - Fetches stock info from Google Sheet (via Apps Script endpoint)
 *  - Displays stock data using elegant embeds
 *  - Handles request timeout and API errors
 ****************************************************************************************/

const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');

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
    note = [],
    interval = []
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
        .setImage(`attachment://${symbol}-$${interval}-chart.png`)
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


/**
 * Generate TradingView chart screenshot for a given ticker and interval
 * @param {string} ticker - Stock ticker, e.g., "MSFT"
 * @param {string} interval - Chart interval: D (Daily), W (Weekly), M (Monthly)
 * @returns {Promise<{files: AttachmentBuilder[]}>}
*/

const { chromium } = require('playwright');

async function generateChart(ticker, interval = 'D') {

    ticker = ticker.toUpperCase();
    interval = interval.toUpperCase();

    let browser;
    let page;

    try {
        // launch chromium with low RAM mode
        browser = await chromium.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
                "--no-zygote"
            ]
        });

        page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 720 });

        // block unnecessary resources
        await page.route("**/*", (route) => {
            const type = route.request().resourceType();
            if (["image", "media", "font"].includes(type)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        const html = `
            <!DOCTYPE html>
            <html>
              <body style="margin:0; padding:0; overflow:hidden;">
                <iframe
                  id="tv-widget"
                  src="https://s.tradingview.com/widgetembed/?symbol=${ticker}&interval=${interval}&theme=dark&style=8&locale=en&hide_volume=true&hide_top_toolbar=true"
                  width="1280"
                  height="720"
                  frameborder="0"
                ></iframe>
              </body>
            </html>
            `;

        await page.setContent(html, { waitUntil: 'networkidle' });

        const frameHandle = await page.$('#tv-widget');
        const frame = await frameHandle.contentFrame();

        await frame.waitForSelector('canvas', { timeout: 20000 });
        await frame.waitForFunction(() => {
            const c = document.querySelector('canvas');
            return c && c.width > 800;
        }, null, { timeout: 20000 });

        // Screenshot
        let screenshotBuffer;
        for (let attempt = 0; attempt <= 2; attempt++) {
            // Delay for loading
            await page.waitForTimeout(1000);
            screenshotBuffer = await frameHandle.screenshot();
            if (screenshotBuffer.length >= 10000) {
                break; // Image ready
            }
        }

        const attachment = new AttachmentBuilder(screenshotBuffer, {
            name: `${ticker}-${interval}-chart.png`
        });

        return [attachment];


    } catch (err) {
        // await interaction.editReply(`❌ Failed to generate chart for **${ticker}**`);
        return null;
    } finally {
        if (page) await page.close();
        if (browser) await browser.close();
    }
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
        ).addStringOption(option =>
            option.setName('interval')
                .setDescription('Chart interval: D (Daily), W (Weekly), M (Monthly)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply(); // Avoid timeout

        const symbol = interaction.options.getString('ticker').toUpperCase();
        const interval = (interaction.options.getString('interval') || 'D').toUpperCase();

        const isChart = interaction.options.getString('interval');
        let attachment = []

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

            // Fetch stock info with timeout
            const response = await fetchWithTimeout(SCRIPT_URL, { method: 'POST', body: formData }, FETCH_TIMEOUT);
            // Check response
            if (!response.ok) throw new Error('Failed to fetch data');
            // Prepare
            const dataInfo = await response.json();
            let embedsToSend = [errorEmbed]; // default

            // Get stock chart
            if (isChart) {
                attachment = await generateChart(dataInfo.ticker, interval);
            }

            const isEmpty = dataInfo && Object.keys(dataInfo).length === 0 && dataInfo.ticker;
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
                    note: dataInfo.note,
                    interval: interval
                });
            }

            // await interaction.editReply({ embeds: embedsToSend });
            await interaction.editReply({ embeds: embedsToSend, files: attachment });

        } catch (error) {
            // console.dir(error, { depth: null, colors: true });

            // Send fallback error
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
