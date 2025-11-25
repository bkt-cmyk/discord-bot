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
            option.setName('eps')
                .setDescription('EPS')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('eps-growth-rate')
                .setDescription('EPS Growth Rate')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('pe')
                .setDescription('PE Ratio')
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
            const eps = interaction.options.getString('eps');
            const epsGrowthRate = interaction.options.getString('eps-growth-rate');
            const appropriatePE = interaction.options.getString('pe');
            const desiredReturn = interaction.options.getString('return');

            // ⭐ FIX: Proper async stock price fetch
            const stockInfo = await fetchStockInfo(ticker);
            if (!stockInfo) return interaction.editReply("❌ Stock price fetch failed.");

            const currentPrice = Number(stockInfo.data[0].regularMarketPrice);

            let info = dcf_earning({
                currentPrice,
                eps: Number(eps),
                epsGrowthRate: Number(epsGrowthRate),
                appropriatePE: Number(appropriatePE),
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
function dcf_earning({
    currentPrice,
    eps,
    epsGrowthRate,
    appropriatePE,
    desiredReturn
}) {

    try {
        const epsGrowthRate_rtn = epsGrowthRate;
        const desiredReturn_rtn = desiredReturn;

        epsGrowthRate = epsGrowthRate >= 0 ? epsGrowthRate / 100 : 0;
        desiredReturn = desiredReturn >= 0 ? desiredReturn / 100 : 0;

        const forecastYear = 5;
        const fairValues = [];

        let lastProjectedPrice = 0;
        let returnFromCurrentPrice = 0;
        let fairValueAt5thYearEPS = 0;

        let projectedEPS = eps;

        for (let year = 1; year <= forecastYear; year++) {
            projectedEPS *= (1 + epsGrowthRate);
            const projectedPrice = appropriatePE * projectedEPS;
            const discountedPrice = (projectedPrice / Math.pow(1 + desiredReturn, year)).toFixed(2);
            lastProjectedPrice = projectedPrice;

            fairValues.push(discountedPrice);
        }

        returnFromCurrentPrice = (
            (Math.pow((lastProjectedPrice / currentPrice), (1 / forecastYear)) - 1) * 100
        ).toFixed(2);

        fairValueAt5thYearEPS = fairValues[forecastYear - 1];

        return {
            currentPrice: ["Stock Price", currentPrice.toFixed(2)],
            eps: ["EPS", eps.toFixed(2)],
            epsGrowthRate: ["EPS Growth Rate", `${epsGrowthRate_rtn}%`],
            appropriatePE: ["P/E Ratio", appropriatePE.toFixed(2)],
            desiredReturn: ["Desired Return", `${desiredReturn_rtn}%`],
            returnFromCurrentPrice: ["▶ Return From Current Price", `${returnFromCurrentPrice} %`],
            fairValueAt5thYearEPS: [
                `▶ Entry Price For ***${desiredReturn_rtn}%*** Return`,
                fairValueAt5thYearEPS
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
        console.error('EPS calculation error:', error);
    }
}


/****************************************************************************************
 * Build Discord Embed
 ****************************************************************************************/
function buildValuationEmbed(embed_info) {
    const {
        currentPrice,
        eps,
        epsGrowthRate,
        appropriatePE,
        desiredReturn,
        returnFromCurrentPrice,
        fairValueAt5thYearEPS,
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
        .setTitle(`🌱 ***Earnings-Based Valuation*** 🌱`)
        .setColor(0xfc21df)
        .addFields(
            { name: returnFromCurrentPrice[0], value: `>>> 🟩 **${returnFromCurrentPrice[1]}**`, inline: false },
            { name: fairValueAt5thYearEPS[0], value: `>>> 🟩 **${fairValueAt5thYearEPS[1]}**`, inline: false },
        )
        .addFields({
            name: "▶ Input Parameter",
            value:
                "```\n" +
                `▪ Stock Price     : ${currentPrice[1]}\n` +
                `▪ EPS             : ${eps[1]}\n` +
                `▪ P/E Ratio       : ${appropriatePE[1]}\n` +
                `▪ EPS Growth Rate : ${epsGrowthRate[1]}\n` +
                `▪ Desired Return  : ${desiredReturn[1]}\n` +
                "```\n",
            inline: false
        })
        .addFields({ name: '▶ Projected Fair Value', value: tableContent, inline: false });
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
