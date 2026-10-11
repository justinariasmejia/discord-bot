// src/commands/duelos.js
// Comando /duelos (alias plural de /duelo)
const { SlashCommandBuilder } = require('discord.js');
const { procesarComandoDuelo } = require('./duelo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duelos')
        .setDescription('⚔️ Desafía a otro cazador a un duelo de reflejos por huesos')
        .addUserOption((opt) =>
            opt.setName('usuario').setDescription('El cazador al que deseas desafiar').setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt.setName('monto').setDescription('Cantidad de huesos a apostar (mínimo 10)').setMinValue(10).setRequired(false)
        ),

    async ejecutar(interaction, client) {
        return procesarComandoDuelo(interaction, client);
    },
};
