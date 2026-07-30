const isAdmin = require('../lib/isAdmin');

/**
 * Gestisce i comandi inattivi e viainattivi
 * @param {object} sock - Istanza del socket Baileys
 * @param {string} chatId - ID del gruppo (JID)
 * @param {string} senderId - ID del mittente (JID)
 * @param {object} message - Oggetto del messaggio originale
 * @param {string} command - Il comando eseguito ('inattivi' oppure 'viainattivi')
 */
async function inattiviHandler(sock, chatId, senderId, message, command = 'inattivi') {
    try {
        // Normalizza il nome del comando rimuovendo eventuali prefissi (. / !)
        const cmd = command.toLowerCase().replace(/^[./!#]/, '');

        // Verifica i permessi di amministrazione
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: 'Per favore, rendi prima il bot amministratore.' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'Solo gli amministratori del gruppo possono usare questo comando.' }, { quoted: message });
            return;
        }

        // Recupera i partecipanti del gruppo
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { text: 'Nessun partecipante trovato nel gruppo.' }, { quoted: message });
            return;
        }

        // Esclude gli amministratori dal controllo inattività
        const nonAdminParticipants = participants.filter(p => !p.admin);

        // Trova gli utenti inattivi controllando il database
        const inattivi = nonAdminParticipants.filter(p => {
            const userData = global.db?.data?.users?.[p.id];
            return !userData || userData.chat === 0 || userData.msg === 0;
        }).map(p => p.id);

        if (inattivi.length === 0) {
            await sock.sendMessage(chatId, { text: 'Nessun utente inattivo trovato nel gruppo! 🎉' }, { quoted: message });
            return;
        }

        // Esecuzione in base al comando
        if (cmd === 'inattivi') {
            let messageText = `══════ •⊰✦⊱• ══════\n`;
            messageText += `𝐑𝐞𝐯𝐢𝐬𝐢𝐨𝐧𝐞 𝐢𝐧𝐚𝐭𝐭𝐢𝐯𝐢 😴\n`;
            messageText += `${groupMetadata.subject}\n\n`;
            messageText += `${inattivi.length} 𝐢𝐧𝐚𝐭𝐭𝐢𝐯𝐢:\n`;

            inattivi.forEach(jid => {
                messageText += `  👉🏻 @${jid.split('@')[0]}\n`;
            });

            messageText += `\n══════ •⊰✦⊱• ══════`;

            await sock.sendMessage(chatId, {
                text: messageText,
                mentions: inattivi
            }, { quoted: message });

        } else if (cmd === 'viainattivi') {
            // Avviso con tag degli utenti da rimuovere
            let messageText = `𝐑𝐈𝐌𝐎𝐙𝐈𝐎𝐍𝐄 𝐈𝐍𝐀𝐓𝐓𝐈𝐕𝐈 🚫\n\n`;
            inattivi.forEach(jid => {
                messageText += `@${jid.split('@')[0]}\n`;
            });

            await sock.sendMessage(chatId, {
                text: messageText,
                mentions: inattivi
            }, { quoted: message });

            // Rimuove gli utenti dal gruppo
            await sock.groupParticipantsUpdate(chatId, inattivi, 'remove');
        }

    } catch (error) {
        console.error('Errore nella gestione degli inattivi:', error);
        await sock.sendMessage(chatId, { text: 'Si è verificato un errore durante l\'esecuzione del comando.' }, { quoted: message });
    }
}

module.exports = inattiviHandler;
