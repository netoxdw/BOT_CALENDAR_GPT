const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");

const welcomeFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, ctxFn) => {
        await ctxFn.endFlow("Bienvenido a este chatbot \n Si deseas agendar una cita puedes escribir 'Agendar cita' para reservar")
    });

module.exports = { welcomeFlow }