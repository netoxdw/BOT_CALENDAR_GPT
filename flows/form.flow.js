const { addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const { createEvent } = require("../scripts/calendar");

const formFlow = addKeyword(EVENTS.ACTION)
    .addAnswer("Excelente! Gracias por confirmar la fecha. Te voy a hacer unas consultas para agendar tu cita. Primero ?cuál es tu nombre?", { capture: true }, 
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ name: ctx.body }); // Guarda el nombre del usuario en el estado
        }
    )
    .addAnswer("Perfecto, ¿Cuál es el motivo de tu cita?", { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ motive: ctx.body }); // Guarda el motivo de la cita
        }
    )
    .addAnswer("Genial, Ya cree la reunion. Te esperamos!", null,
        async (ctx, ctxFn) => {
            const userInfo = await ctxFn.state.getMyState();
            const eventName = userInfo.name;
            const description = userInfo.motive;
            const date = userInfo.date;
            const eventId = await createEvent(eventName, description, date)
            await ctxFn.state.clear(); 
        }
    )

module.exports = { formFlow }


