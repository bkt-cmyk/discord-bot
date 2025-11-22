const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { chromium } = require('playwright');  // ⭐ เปลี่ยน puppeteer → playwright

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

        await interaction.deferReply();

        try {

            // ⭐ Launch Playwright Chromium
            const browser = await chromium.launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-software-rasterizer",
                    "--no-zygote",
                    "--single-process"
                ]
            });


            const page = await browser.newPage();
            await page.setViewportSize({ width: 1280, height: 720 });

            // Load TradingView iframe
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

            // Get iframe
            const frameHandle = await page.$('#tv-widget');
            const frame = await frameHandle.contentFrame();

            // Wait for chart canvas
            await frame.waitForSelector('canvas', { timeout: 20000 });

            // Ensure canvas is fully rendered
            await frame.waitForFunction(() => {
                const c = document.querySelector('canvas');
                return c && c.width > 800;
            }, null, { timeout: 20000 });

            // ⭐ Screenshot from iframe element
            let screenshotBuffer;
            for (let i = 0; i < 3; i++) {
                try {
                    screenshotBuffer = await frameHandle.screenshot();
                    if (screenshotBuffer) break;
                } catch (e) {
                    await new Promise(res => setTimeout(res, 1000));
                }
            }

            const attachment = new AttachmentBuilder(screenshotBuffer, {
                name: `${ticker}-chart.png`
            });

            const embed = new EmbedBuilder()
                .setColor(0x23f9fc)
                .setImage(`attachment://${ticker}-chart.png`)
                .setTitle(`${ticker} Chart (${interval})`);

            await interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });

            await browser.close();

        } catch (err) {
            console.error(err);
            await interaction.editReply(`❌ Failed to generate chart for **${ticker}**`);
        }
    }
};
