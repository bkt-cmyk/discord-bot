const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js'); // Add EmbedBuilder
const puppeteer = require('puppeteer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chart')
        .setDescription('Get stock chart')
        .addStringOption(option =>
            option.setName('ticker')
                .setDescription('Stock ticker, e.g., NVDA')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('interval')
                .setDescription('Chart interval: D (Daily), W (Weekly), M (Monthly)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const ticker = interaction.options.getString('ticker').toUpperCase();
        const interval = (interaction.options.getString('interval') || 'D').toUpperCase();

        await interaction.deferReply(); // Inform Discord that loading

        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ]
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });

            // Load TradingView iframe
            const html = `
            <!DOCTYPE html>
            <html>
              <body>
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
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const frameElement = await page.$('#tv-widget');
            const frame = await frameElement.contentFrame();

            // Wait until canvas is loaded and has proper size
            await frame.waitForSelector('canvas', { timeout: 20000 });
            await frame.waitForFunction(() => {
                const c = document.querySelector('canvas');
                return c && c.width >= 800 && c.height >= 600;
            }, { timeout: 20000 });

            // Retry screenshot 3 times if fail
            let screenshotBuffer;
            for (let i = 0; i < 3; i++) {
                try {
                    screenshotBuffer = await frameElement.screenshot();
                    if (screenshotBuffer) break;
                } catch (e) {
                    // console.log(`Retry screenshot ${i + 1}...`);
                    await new Promise(res => setTimeout(res, 1000));
                }
            }

            // Create attachment from buffer
            const attachment = new AttachmentBuilder(screenshotBuffer, { name: `${ticker}-chart.png` });

            // Create an embed with the chart
            const embed = new EmbedBuilder()
                .setColor(0x23f9fc) // Optional: embed color
                .setImage(`attachment://${ticker}-chart.png`);

            // Send embed with attachment
            await interaction.editReply({ embeds: [embed], files: [attachment] });

            await browser.close();
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Failed to generate chart for ${ticker}`);
        }
    },
};
