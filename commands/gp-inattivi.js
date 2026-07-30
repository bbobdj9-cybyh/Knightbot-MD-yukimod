const isAdmin = require('../lib/isAdmin');

async function inattiviCommand(sock, chatId, senderId, message) {
    try {
        // Verifica che sia un gruppo
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: 'Questo comando funziona solo nei gruppi.' }, { quoted: message });
            return;
        }

        // Controllo permessi Admin
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: 'Per favore, rendi prima il bot amministratore.' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'Solo gli amministratori del gruppo possono usare questo comando.' }, { quoted: message });
            return;
        }

        // Estrae il comando e l'eventuale numero (.inattivi o .inattivi 10)
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     message.message?.videoMessage?.caption || '';
                     
        const parts = text.trim().split(/\s+/);
        const command = parts[0].toLowerCase().replace(/^[./!#]/, '');
        const limit = parseInt(parts[1]);

        // Recupera i partecipanti dal gruppo
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata?.participants || [];

        // Filtra ed esclude gli amministratori
        const nonAdminParticipants = participants.filter(p => !p.admin).map(p => p.id);

        if (nonAdminParticipants.length === 0) {
            await sock.sendMessage(chatId, { text: 'Nessun membro non-admin trovato nel gruppo.' }, { quoted: message });
            return;
        }

        let inattivi = [];

        // 1. Se il bot ha un database globale (global.db), controlla i dati
        if (global.db?.data?.users) {
            inattivi = nonAdminParticipants.filter(jid => {
                const user = global.db.data.users[jid];
                return !user || user.chat === 0 || user.msg === 0 || user.messages === 0;
            });
        } else {
            // 2. Se non c'è DB, considera i membri non-admin
            inattivi = [...nonAdminParticipants];
        }

        // Se hai specificato un numero (es. .inattivi 5 o .viainattivi 5)
        if (!isNaN(limit) && limit > 0) {
            inattivi = inattivi.slice(0, limit);
        }

        if (inattivi.length === 0) {
            await sock.sendMessage(chatId, { text: 'Nessun utente inattivo trovato nel gruppo! 🎉' }, { quoted: message });
            return;
        }

        // Esecuzione .inattivi
        if (command === 'inattivi') {
            let messageText = `══════ •⊰✦⊱• ══════\n`;
            messageText += `𝐑𝐞𝐯𝐢𝐬𝐢𝐨𝐧𝐞 𝐢𝐧𝐚𝐭𝐭𝐢𝐯𝐢 😴\n`;
            messageText += `${groupMetadata.subject}\n\n`;
            messageText += `${inattivi.length} 𝐢𝐧𝐚𝐭𝐭𝐢𝐯𝐢:\n`;

            inattivi.forEach(jid => {
                messageText += `  👉🏻 @${jid.split('@')[0]}\n`;
            });

            messageText += `\n══════ •⊰✦⊱• ══════`;

            await sock.sendMessage(chatId, { text: messageText, mentions: inattivi }, { quoted: message });

        // Esecuzione .viainattivi
        } else if (command === 'viainattivi') {
            let messageText = `𝐑𝐈𝐌𝐎𝐙𝐈𝐎𝐍𝐄 𝐈𝐍𝐀𝐓𝐓𝐈𝐕𝐈 🚫\n\n`;
            inattivi.forEach(jid => {
                messageText += `@${jid.split('@')[0]}\n`;
            });

            await sock.sendMessage(chatId, { text: messageText, mentions: inattivi }, { quoted: message });

            // Rimuove gli utenti dal gruppo
            await sock.groupParticipantsUpdate(chatId, inattivi, 'remove');
        }

    } catch (error) {
        console.error('Errore nel comando inattivi:', error);
        await sock.sendMessage(chatId, { text: 'Si è verificato un errore durante l\'esecuzione del comando.' }, { quoted: message });
    }
}

module.exports = inattiviCommand;
