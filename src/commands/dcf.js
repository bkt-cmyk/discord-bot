const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');


/****************************************************************************************
 * Main Function
 ****************************************************************************************/

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dcf-fcf')
        .setDescription('Calculate Intrinsic Value by FCF')
        .addStringOption(option =>
            option.setName('price')
                .setDescription('Current Price')
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

            const currentPrice = interaction.options.getString('price');
            const eps = interaction.options.getString('eps');
            const epsGrowthRate = interaction.options.getString('eps-growth-rate');
            const appropriatePE = interaction.options.getString('pe');
            const desiredReturn = interaction.options.getString('return');

            const info = dcf_earning({
                currentPrice: Number(currentPrice),
                eps: Number(eps),
                epsGrowthRate: Number(epsGrowthRate),
                appropriatePE: Number(appropriatePE),
                desiredReturn: Number(desiredReturn)
            });

            const embed = buildValuationEmbed(info);

            await interaction.editReply({ embeds: [embed] });

        }
        catch (error) {
            // console.error(error.message);
            await interaction.editReply('Error!');
        }
    },
};



/****************************************************************************************
 * 🎨 createEmbed(data)
 ****************************************************************************************/
function dcf_earning({
    currentPrice = '',
    eps = '',
    epsGrowthRate = '',
    appropriatePE = '',
    desiredReturn = ''
}) {

    try {
        // convert to percent
        const epsGrowthRate_rtn = epsGrowthRate;
        const desiredReturn_rtn = epsGrowthRate;
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

        // Return from current price
        returnFromCurrentPrice = ((Math.pow((lastProjectedPrice / currentPrice), (1 / forecastYear)) - 1) * 100).toFixed(2);
        fairValueAt5thYearEPS = (fairValues[forecastYear - 1]);

        // Embedded Info
        const embed_info = {
            currentPrice: [
                'Stock Price',
                `$ ${Number(currentPrice).toFixed(2)}`

            ],
            eps: [
                'EPS',
                `$ ${Number(eps).toFixed(2)}`
            ],
            epsGrowthRate: [
                'EPS Growth Rate',
                `${Number(epsGrowthRate_rtn).toFixed(2)} %`

            ],
            appropriatePE: [
                'P/E Ratio',
                `${Number(appropriatePE).toFixed(2)}`

            ],
            desiredReturn: [
                'Desired Return',
                `${Number(desiredReturn_rtn).toFixed(2)} %`

            ],
            returnFromCurrentPrice: [
                '▶ Return From Current Price',
                `${Number(returnFromCurrentPrice).toFixed(2)} %`

            ],
            fairValueAt5thYearEPS: [
                `▶ Entry Price For ***${desiredReturn_rtn}%*** Return`,
                `$ ${Number(fairValueAt5thYearEPS).toFixed(2)}`

            ],
            fairValues: [
                `Projected Fair Value`,
                [
                    { year: 1, value: fairValues[0] },
                    { year: 2, value: fairValues[1] },
                    { year: 3, value: fairValues[2] },
                    { year: 4, value: fairValues[3] },
                    { year: 5, value: fairValues[4] },
                ]
            ],
        };

        return embed_info;

    } catch (error) {
        console.error('EPS calculation error:', error);
    }
}


function buildValuationEmbed(embed_info) {
    const {
        currentPrice,
        eps,
        epsGrowthRate,
        appropriatePE,
        desiredReturn,
        returnFromCurrentPrice,
        fairValueAt5thYearEPS,
        fairValues
    } = embed_info;

    // Create fair value table (Year 1 → Year 5)
    const tableHeader = 'Year | Fair Value\n-----|-----------';
    const tableRows = fairValues[1].map(item =>
        `${String(item.year).padEnd(4)} | $ ${item.value}`
    ).join('\n');

    const tableContent = '```\n' + tableHeader + '\n' + tableRows + '\n```';

    return new EmbedBuilder()
        .setTitle(`🌱 ***Earnings-Based Valuation*** 🌱`)
        .setColor(0xfc21df)

        // Result Fields
        .addFields(
            { name: returnFromCurrentPrice[0], value: `>>> **${returnFromCurrentPrice[1]}**`, inline: true },
            { name: fairValueAt5thYearEPS[0], value: `>>> **${fairValueAt5thYearEPS[1]}**`, inline: true },
        )

        // Input Fields
        .addFields(
            {
                name: "▶ Input Parameter",
                value: "```\n" +
                    `▪ ${currentPrice[0].padEnd(16)}: ${currentPrice[1]}` + `\n` +
                    `▪ ${eps[0].padEnd(16)}: ${eps[1]}` + `\n` +
                    `▪ ${appropriatePE[0].padEnd(16)}: ${appropriatePE[1]}` + `\n` +
                    `▪ ${epsGrowthRate[0].padEnd(16)}: ${epsGrowthRate[1]}` + `\n` +
                    `▪ ${desiredReturn[0].padEnd(16)}: ${desiredReturn[1]}` + `\n` +
                    "```\n",
                inline: false
            },
        )

        // Fair Value Table
        .addFields(
            { name: '▶ Projected Fair Value', value: tableContent, inline: false }
        )
}
