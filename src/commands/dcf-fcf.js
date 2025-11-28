const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require("axios");

/****************************************************************************************
 * Main Function
 ****************************************************************************************/

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dcf-fcf')
        .setDescription('Calculate Intrinsic Value by FCF')
        .addStringOption(option =>
            option.setName('ticker')
                .setDescription('Stock Symbol')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('fcf-per-share')
                .setDescription('Free Cash Flow per Share')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('fcf-growth-rate')
                .setDescription('FCF Growth Rate')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('fcf-yield')
                .setDescription('FCF Yield')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('return')
                .setDescription('Desired Return')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {

            await interaction.deferReply(); // Avoid timeout

            const ticker = interaction.options.getString('ticker');
            const fcfShare = interaction.options.getString('fcf-per-share');
            const fcfGrowthRate = interaction.options.getString('fcf-growth-rate');
            const fcfYield = interaction.options.getString('fcf-yield');
            const desiredReturn = interaction.options.getString('return');

            // ⭐ FIX: Proper async stock price fetch
            const stockInfo = await fetchStockInfo(ticker);
            if (!stockInfo) return interaction.editReply("❌ Stock price fetch failed.");

            const currentPrice = Number(stockInfo.data[0].regularMarketPrice);

            let info = dcf_fcf({
                currentPrice,
                fcfShare: Number(fcfShare),
                fcfGrowthRate: Number(fcfGrowthRate),
                fcfYield: Number(fcfYield),
                desiredReturn: Number(desiredReturn),
            });

            // Add new values
            info.ticker = stockInfo.data[0].ticker;
            info.longName = stockInfo.data[0].longName;

            const embed = buildValuationEmbed(info);

            await interaction.editReply({ embeds: [embed] });

        }
        catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error!');
        }
    },
};


/****************************************************************************************
 * DCF Calculation
 ****************************************************************************************/
function dcf_fcf({
    currentPrice,
    fcfShare,
    fcfGrowthRate,
    fcfYield,
    desiredReturn
}) {

    try {
        const fcfGrowthRate_rtn = fcfGrowthRate;
        const fcfYield_rtn = fcfYield;
        const desiredReturn_rtn = desiredReturn;

        fcfGrowthRate = fcfGrowthRate >= 0 ? fcfGrowthRate / 100 : 0;
        fcfYield = fcfYield >= 0 ? fcfYield / 100 : 0;
        desiredReturn = desiredReturn >= 0 ? desiredReturn / 100 : 0;

        const forecastYear = 5;
        const fairValues = [];

        let lastProjectedPrice = 0;
        let returnFromCurrentPrice = 0;
        let fairValueAt5thYearCF = 0;

        let projectedFCFShare = fcfShare;

        for (let year = 1; year <= forecastYear; year++) {
            projectedFCFShare *= (1 + fcfGrowthRate);
            const projectedPrice = projectedFCFShare / fcfYield;
            const discountedPrice = (projectedPrice / Math.pow(1 + desiredReturn, year)).toFixed(2);
            lastProjectedPrice = projectedPrice;

            fairValues.push(discountedPrice);
        }

        // Return from current price
        returnFromCurrentPrice = ((Math.pow((lastProjectedPrice / currentPrice), (1 / forecastYear)) - 1) * 100);
        fairValueAt5thYearCF = (fairValues[forecastYear - 1]);


        return {
            currentPrice: ["Stock Price", currentPrice.toFixed(2)],
            fcfShare: ["FCF/Share", fcfShare.toFixed(2)],
            fcfGrowthRate: ["FCF Growth Rate", `${fcfGrowthRate_rtn.toFixed(2)}%`],
            fcfYield: ["FCF Yield", `${fcfYield_rtn.toFixed(2)}%`],
            desiredReturn: ["Desired Return", `${desiredReturn_rtn.toFixed(2)}%`],
            returnFromCurrentPrice: ["▶ Return From Current Price", `${returnFromCurrentPrice.toFixed(2)}%`],
            fairValueAt5thYearCF: [
                `▶ Entry Price For ***${desiredReturn_rtn}%*** Return`,
                fairValueAt5thYearCF
            ],
            fairValues: [
                "Projected Fair Value",
                [
                    { year: 1, value: fairValues[0] },
                    { year: 2, value: fairValues[1] },
                    { year: 3, value: fairValues[2] },
                    { year: 4, value: fairValues[3] },
                    { year: 5, value: fairValues[4] },
                ]
            ],
        };

    } catch (error) {
        console.error('FCF calculation error:', error);
    }
}

/****************************************************************************************
 * Build Discord Embed
 ****************************************************************************************/
function buildValuationEmbed(embed_info) {
    const {
        currentPrice,
        fcfShare,
        fcfGrowthRate,
        fcfYield,
        desiredReturn,
        returnFromCurrentPrice,
        fairValueAt5thYearCF,
        fairValues,
        ticker,
        longName,
    } = embed_info;

    const tableHeader = 'Year | Fair Value\n-----|-----------';
    const tableRows = fairValues[1].map(item =>
        `${String(item.year).padEnd(4)} | ${item.value}`
    ).join('\n');

    const tableContent = '```\n' + tableHeader + '\n' + tableRows + '\n```';

    return new EmbedBuilder()
        .setAuthor({
            name: `${ticker} | ${longName}`
        })
        .setColor(0xff1cf4)
        .addFields(
            { name: returnFromCurrentPrice[0], value: `>>> 🟪 **${returnFromCurrentPrice[1]}**`, inline: false },
            { name: fairValueAt5thYearCF[0], value: `>>> 🟪 **${fairValueAt5thYearCF[1]}**`, inline: false },
        )
        .addFields({
            name: "▶ Input Parameter",
            value:
                "```\n" +
                `▪ Stock Price     : ${currentPrice[1]}\n` +
                `▪ FCF/Share       : ${fcfShare[1]}\n` +
                `▪ FCF Growth Rate : ${fcfGrowthRate[1]}\n` +
                `▪ FCF Yield       : ${fcfYield[1]}\n` +
                `▪ Desired Return  : ${desiredReturn[1]}\n` +
                "```\n",
            inline: false
        })
        .addFields({ name: '▶ Projected Fair Value', value: tableContent, inline: false })
        .setFooter({ text: `🌱 DCF ・  FCF-Based Valuation 🌱` })
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
