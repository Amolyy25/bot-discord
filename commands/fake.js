const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fake')
        .setDescription('Recherche l\'avatar d\'un utilisateur sur internet pour détecter les fakes')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à vérifier')
                .setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getUser('utilisateur');
        await this.handleFakeCheck(interaction, target);
    },

    async executeMessage(message, args) {
        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -fake @utilisateur ou ID');
        await this.handleFakeCheck(message, target);
    },

    async handleFakeCheck(context, target) {
        const isInteraction = !!context.isCommand;
        const msg = isInteraction 
            ? await context.reply({ content: `Recherche de correspondances pour **${target.tag}**... Patientez 10-15 secondes.`, fetchReply: true })
            : await context.channel.send(`Recherche de correspondances pour **${target.tag}**... Patientez 10-15 secondes.`);

        const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 512 });
        // Utilisation de Yandex qui est plus efficace pour les visages et moins protecteur sur les captchas
        const searchUrl = `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(avatarUrl)}`;

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            });
            const page = await browser.newPage();
            
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 1200 });

            // On va sur Yandex
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Attendre que les résultats se chargent
            await new Promise(r => setTimeout(r, 8000));

            // Essayer de cliquer sur l'onglet "Similar images" (Похожие images) si Yandex est en russe/eng
            try {
                const similarTab = await page.$x("//div[contains(text(), 'Similar') or contains(text(), 'Похожие')]");
                if (similarTab.length > 0) {
                    await similarTab[0].click();
                    await new Promise(r => setTimeout(r, 3000));
                }
            } catch (e) {}

            // Prendre le screenshot
            const screenshot = await page.screenshot({ fullPage: false });

            const attachment = new AttachmentBuilder(screenshot, { name: 'fake-search.png' });
            
            const content = `Voici les résultats de recherche Yandex pour **${target.tag}** :\nLien direct : <${searchUrl}>`;
            
            if (isInteraction) {
                await context.editReply({ content: content, files: [attachment] });
            } else {
                await msg.edit({ content: content, files: [attachment] });
            }

        } catch (error) {
            console.error(error);
            const errorMsg = 'Une erreur est survenue lors de la recherche.';
            if (isInteraction) await context.editReply({ content: errorMsg });
            else await msg.edit(errorMsg);
        } finally {
            if (browser) await browser.close();
        }
    }
};
