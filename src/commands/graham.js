const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require("axios");

/****************************************************************************************
 * Main Function
 ****************************************************************************************/

module.exports = {
    data: new SlashCommandBuilder()
        .setName('graham')
        .setDescription('Benjamin Graham Intrinsic Value Formula')
        .addStringOption(option =>
            option.setName('ticker')
                .setDescription('Stock Symbol')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('eps')
                .setDescription('Earnings Per Share (12 months trailing)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('eps-growth')
                .setDescription('Long-term earnings growth rate, as a percentage (e.g., 7.61)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('bond-yield')
                .setDescription('Current AAA corporate bond yield, as a percentage (e.g., 5.25)')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {

            await interaction.deferReply(); // Avoid timeout

            const ticker = interaction.options.getString('ticker');
            const eps = interaction.options.getString('eps');
            const epsGrowthRate = interaction.options.getString('eps-growth');
            const bondYield = interaction.options.getString('bond-yield');

            // ⭐ FIX: Proper async stock price fetch
            const stockInfo = await fetchStockInfo(ticker);
            if (!stockInfo) return interaction.editReply("❌ Stock price fetch failed.");

            let info = calculateGrahamIntrinsicValue(eps, epsGrowthRate, bondYield);

            // Add new values
            info.currentPrice = Number(stockInfo.data[0].regularMarketPrice);
            info.ticker = stockInfo.data[0].ticker;
            info.longName = stockInfo.data[0].longName;
            info.eps = eps;
            info.epsGrowthRate = epsGrowthRate;
            info.bondYield = bondYield;

            const embed = buildValuationEmbed(info);

            await interaction.editReply({ embeds: [embed] });

        }
        catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error!');
        }
    },
};


/**
 * Benjamin Graham Intrinsic Value Formula (Modified Variation from Image)
 *
 * The formula provided is:
 * V = EPS * (8.5 + 2g) * (4.4 / Y)
 *
 * Based on calculation validation against the table results, 'g' (growth rate)
 * and 'Y' (AAA bond yield) must be passed as percentage values (e.g., 7.61, 5.25),
 * not as decimals (0.0761, 0.0525).
 *
 * @param {number} eps - Earnings Per Share (12 months trailing).
 * @param {number} g_percent - Long-term earnings growth rate, as a percentage (e.g., 7.61).
 * @param {number} Y_percent - Current AAA corporate bond yield, as a percentage (e.g., 5.25).
 * @returns {number} - The calculated Intrinsic Value (V).
 */
function calculateGrahamIntrinsicValue(eps, g_percent, Y_percent) {
    if (Y_percent === 0) {
        console.error("Error: AAA Bond Yield (Y) cannot be zero for division.");
        return NaN;
    }
    // V = EPS * (8.5 + 2g) * (4.4 / Y)
    const V = (eps * (8.5 + 2 * g_percent) * (4.4 / Y_percent)).toFixed(2);

    return {
        GrahamIntrinsicValue: V
    };
}

/****************************************************************************************
 * Build Discord Embed
 ****************************************************************************************/
function buildValuationEmbed(embed_info) {
    const {
        GrahamIntrinsicValue,
        currentPrice,
        ticker,
        longName,
        eps,
        epsGrowthRate,
        bondYield
    } = embed_info;

    return new EmbedBuilder()
        .setAuthor({
            name: `${ticker} | ${longName}`
        })
        .setColor(0xfff81f)
        .setTitle(GrahamIntrinsicValue !== 'NULL' ? `>>> 🟨 **${GrahamIntrinsicValue}**` : 'NULL')
        .addFields({
            name: "▶ Input Parameter",
            value:
                "```\n" +
                `▪ Stock Price     : ${currentPrice}\n` +
                `▪ EPS             : ${eps}\n` +
                `▪ EPS Growth Rate : ${epsGrowthRate}%\n` +
                `▪ Bond Yield      : ${bondYield}%\n` +
                "```\n",
            inline: false
        })
        .setFooter({ text: `🌱 Benjamin Graham Intrinsic Value 🌱` })
}

/****************************************************************************************
 * fetchStockInfo() (async helper)
 ****************************************************************************************/
async function fetchStockInfo(symbol) {
    try {
        const cleanSymbol = symbol.replace(/\./g, "-").toUpperCase();
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}`;

        const res = await axios.get(url);
        const json = res.data;

        if (!json.chart || !json.chart.result || json.chart.result.length === 0) {
            throw new Error(`No data found for symbol: ${cleanSymbol}`);
        }

        const meta = json.chart.result[0].meta;

        return {
            data: [
                {
                    ticker: cleanSymbol,
                    currency: meta.currency || "",
                    regularMarketPrice: (meta.regularMarketPrice ?? 0).toFixed(2),
                    longName: meta.longName || meta.shortName || "",
                }
            ]
        };

    } catch (err) {
        console.error(`Error fetching stock info for ${symbol}: ${err.message}`);
        return null;
    }
}
