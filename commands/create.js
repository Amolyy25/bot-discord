const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require('discord.js');

async function handleCreate(context, isInteraction) {
  const currentEmbed = new EmbedBuilder().setDescription('Embed vide.');
  let targetChannel = null;

  const btnText = new ButtonBuilder().setCustomId('embed_text').setLabel('Texte').setStyle(ButtonStyle.Primary);
  const btnColor = new ButtonBuilder().setCustomId('embed_color').setLabel('Couleur').setStyle(ButtonStyle.Secondary);
  const btnImages = new ButtonBuilder().setCustomId('embed_images').setLabel('Images').setStyle(ButtonStyle.Secondary);
  const btnAuthFoot = new ButtonBuilder().setCustomId('embed_authfoot').setLabel('Auteur/Footer').setStyle(ButtonStyle.Secondary);
  
  const btnSend = new ButtonBuilder().setCustomId('embed_send').setLabel('Envoyer l\'embed').setStyle(ButtonStyle.Success);

  const selectChannel = new ChannelSelectMenuBuilder()
    .setCustomId('embed_channel')
    .setPlaceholder('Sélectionner le salon d\'envoi')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

  const getMessagePayload = () => {
    const rowButtons = new ActionRowBuilder().addComponents(btnText, btnColor, btnImages, btnAuthFoot);
    const rowChannel = new ActionRowBuilder().addComponents(selectChannel);
    const rowSend = new ActionRowBuilder().addComponents(btnSend);

    return {
      content: "**Outil de création d'embed interactif :**",
      embeds: [currentEmbed],
      components: [rowButtons, rowChannel, rowSend]
    };
  };

  let responseMessage;
  if (isInteraction) {
    responseMessage = await context.reply({ ...getMessagePayload(), fetchReply: true });
  } else {
    responseMessage = await context.channel.send(getMessagePayload());
  }

  const collector = responseMessage.createMessageComponentCollector({
    filter: i => i.user.id === (isInteraction ? context.user.id : context.author.id),
    time: 15 * 60 * 1000 
  });

  collector.on('collect', async i => {
    if (i.isChannelSelectMenu() && i.customId === 'embed_channel') {
      targetChannel = i.channels.first();
      await i.reply({ content: `Salon sélectionné : <#${targetChannel.id}>`, flags: 64 });
      return;
    }

    if (i.customId === 'embed_send') {
      if (!targetChannel) {
        return i.reply({ content: 'Veuillez d\'abord sélectionner un salon dans le menu déroulant !', flags: 64 });
      }
      try {
        await targetChannel.send({ embeds: [currentEmbed] });
        await i.reply({ content: `Embed envoyé avec succès dans <#${targetChannel.id}> !`, flags: 64 });
        collector.stop('sent');
      } catch (e) {
        console.error(e);
        await i.reply({ content: 'Erreur lors de l\'envoi de l\'embed. Vérifiez les permissions du bot dans ce salon.', flags: 64 });
      }
      return;
    }

    if (i.customId === 'embed_text') {
      const modal = new ModalBuilder().setCustomId('modal_text').setTitle('Titre & Description');
      const titleInput = new TextInputBuilder().setCustomId('title').setLabel('Titre').setStyle(TextInputStyle.Short).setRequired(false);
      const descInput = new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false);
      
      if (currentEmbed.data.title) titleInput.setValue(currentEmbed.data.title);
      if (currentEmbed.data.description && currentEmbed.data.description !== 'Embed vide.') descInput.setValue(currentEmbed.data.description);

      modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput));
      await i.showModal(modal);
    } else if (i.customId === 'embed_color') {
      const modal = new ModalBuilder().setCustomId('modal_color').setTitle('Couleur Météor (ex: FF0000)');
      const colorInput = new TextInputBuilder().setCustomId('color').setLabel('Code Hex ou nom (ex: FF0000)').setStyle(TextInputStyle.Short).setRequired(false);
      
      if (currentEmbed.data.color !== undefined && currentEmbed.data.color !== null) {
        colorInput.setValue(currentEmbed.data.color.toString(16).padStart(6, '0'));
      }
      
      modal.addComponents(new ActionRowBuilder().addComponents(colorInput));
      await i.showModal(modal);
    } else if (i.customId === 'embed_images') {
      const modal = new ModalBuilder().setCustomId('modal_images').setTitle('Images');
      const imgInput = new TextInputBuilder().setCustomId('image').setLabel('URL de l\'image (grande)').setStyle(TextInputStyle.Short).setRequired(false);
      const thumbInput = new TextInputBuilder().setCustomId('thumbnail').setLabel('URL de la miniature (thumbnail)').setStyle(TextInputStyle.Short).setRequired(false);
      
      if (currentEmbed.data.image?.url) imgInput.setValue(currentEmbed.data.image.url);
      if (currentEmbed.data.thumbnail?.url) thumbInput.setValue(currentEmbed.data.thumbnail.url);

      modal.addComponents(new ActionRowBuilder().addComponents(imgInput), new ActionRowBuilder().addComponents(thumbInput));
      await i.showModal(modal);
    } else if (i.customId === 'embed_authfoot') {
      const modal = new ModalBuilder().setCustomId('modal_authfoot').setTitle('Auteur & Footer');
      const authorInput = new TextInputBuilder().setCustomId('author').setLabel('Nom de l\'auteur').setStyle(TextInputStyle.Short).setRequired(false);
      const footerInput = new TextInputBuilder().setCustomId('footer').setLabel('Texte du footer').setStyle(TextInputStyle.Short).setRequired(false);
      
      if (currentEmbed.data.author?.name) authorInput.setValue(currentEmbed.data.author.name);
      if (currentEmbed.data.footer?.text) footerInput.setValue(currentEmbed.data.footer.text);

      modal.addComponents(new ActionRowBuilder().addComponents(authorInput), new ActionRowBuilder().addComponents(footerInput));
      await i.showModal(modal);
    }

    if (['embed_text', 'embed_color', 'embed_images', 'embed_authfoot'].includes(i.customId)) {
      try {
        const modalSubmit = await i.awaitModalSubmit({ time: 300000, filter: m => m.user.id === i.user.id }).catch(() => null);
        
        if (!modalSubmit) return; // timeout or error

        if (modalSubmit.customId === 'modal_text') {
          const title = modalSubmit.fields.getTextInputValue('title');
          const desc = modalSubmit.fields.getTextInputValue('description');
          
          if (title) currentEmbed.setTitle(title); else currentEmbed.setTitle(null);
          if (desc) currentEmbed.setDescription(desc); else currentEmbed.setDescription(null);
          if (!currentEmbed.data.title && !currentEmbed.data.description && !currentEmbed.data.image) {
            currentEmbed.setDescription('Embed vide.');
          }
        } else if (modalSubmit.customId === 'modal_color') {
          const color = modalSubmit.fields.getTextInputValue('color');
          try {
            if (color) {
              const hexColor = color.replace(/[^0-9A-F]/gi, '');
              const parsedColor = parseInt(hexColor, 16);
              if (!isNaN(parsedColor)) {
                  currentEmbed.setColor(parsedColor);
              }
            } else currentEmbed.setColor(null);
          } catch(e) {}
        } else if (modalSubmit.customId === 'modal_images') {
          const img = modalSubmit.fields.getTextInputValue('image');
          const thumb = modalSubmit.fields.getTextInputValue('thumbnail');
          
          try { if (img) currentEmbed.setImage(img); else currentEmbed.setImage(null); } catch(e){}
          try { if (thumb) currentEmbed.setThumbnail(thumb); else currentEmbed.setThumbnail(null); } catch(e){}
        } else if (modalSubmit.customId === 'modal_authfoot') {
          const author = modalSubmit.fields.getTextInputValue('author');
          const footer = modalSubmit.fields.getTextInputValue('footer');
          
          if (author) currentEmbed.setAuthor({ name: author }); else currentEmbed.setAuthor(null);
          if (footer) currentEmbed.setFooter({ text: footer }); else currentEmbed.setFooter(null);
        }

        await modalSubmit.update(getMessagePayload());
      } catch (err) {
        console.error("Erreur avec le modal :", err);
      }
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'sent') {
      if (responseMessage.editable) responseMessage.delete().catch(()=>{});
    } else {
      if (responseMessage.editable) {
        responseMessage.edit({ content: '**Outil de création d\'embed expiré.**', components: [] }).catch(()=>{});
      }
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Ouvre une interface interactive pour créer un embed'),

  async execute(interaction) {
    const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
    if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
    if (!checkPermission(interaction.member, 'create')) {
        return interaction.reply({ content: 'non ta pas la perm', flags: 64 });
    }
    await handleCreate(interaction, true);
  },

  async executeMessage(message) {
    const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
    if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
    if (!checkPermission(message.member, 'create')) {
        return message.reply('non ta pas la perm');
    }
    await handleCreate(message, false);
  }
};
