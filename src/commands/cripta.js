// /cripta → abre el panel principal (privado, solo lo ve quien lo usa).
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { obtenerUsuario } = require('../services/economia');
const { panelMenu } = require('../utils/paneles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cripta')
        .setDescription('🎃 Abre la Cripta de los Huesos: cazar, diario, apostar y ranking'),

    async ejecutar(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const usuario = await obtenerUsuario(interaction.user.id, interaction.guildId);
        await interaction.editReply(panelMenu(interaction.user.id, usuario));
    },
};
