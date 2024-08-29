const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");

const welcomeFlow = addKeyword(EVENTS.ACTION)
    .addAnswer('¡Hola! 👋 Bienvenido al asistente virtual del consultorio. Estoy aquí para ayudarte a agendar citas y proporcionarte información sobre nuestros servicios.')
    .addAction(
        async (ctx, ctxFn) => {
        await ctxFn.endFlow("¿En qué puedo asistirte hoy?  \n Si deseas agendar una cita puedes escribir 'Agendar cita' para reservar");
    });


module.exports = { welcomeFlow }