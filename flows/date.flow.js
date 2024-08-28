const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");
const { text2iso, iso2text } = require("../scripts/utils")
const { isDateAvailable, getNextAvailableSlot } = require("../scripts/calendar")
const { chat } = require("../scripts/chatGPT")

const { formFlow } = require("./form.flow");
const { content } = require("googleapis/build/src/apis/content");


const promptBase = `
    Eres un aistente virtual diseñado para ayudar a los usuarios a agendar citas mediante una conversacion.
    Tu objetivo es unicamente ayudar a elegir un horario y una fecha para sacar turno.
    Te voy a dar la fecha solicitada por el usuario y la disponibilidad de la misma. Esta fecha la tiene que confirmar el usuario.
    Si la disponibilidad es true, entonces responde algo como: La fecha solicitada esta disponible. El turno seria el Jueves 30 de mayo de 2024 a las 10:00hrs.
    Si la disponibilidad es false, entonces recomienda la siguiente fecha disponible que te dejo al final del prompt, suponiendo que la siguiente fecha disponible es el jueves 30, responde con este formato. La fecha y horario solicitados no estan disponibles, te puedo ofrecer el Jueves 30 de mayo 2024 a las 11:00hrs.
    Bajo ninguna circunsatancia hagas consultas.
    En vez de decir que la disponibilidad es false, envia una disculpa de que esa fecha no esta disponible, y ofrece la siguiente.
    Te dejo los estados actualizados de dichas fechas.
`;

const confirmationFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    "Confirmas la fecha propuesta? Responde únicamente con 'si' o 'no'",
    { capture: true }, // Cambiado a 'true' para capturar la respuesta del usuario
    async (ctx, ctxFn) => {
      const respuestaUsuario = ctx.body.trim().toLowerCase(); // Captura y limpia la respuesta del usuario
    
        // Aquí puedes agregar más lógica basada en la respuesta del usuario
        if (respuestaUsuario === 'si') {
          console.log("El usuario ha confirmado la fecha.");
          return ctxFn.gotoFlow(formFlow)
          // Realiza las acciones necesarias para la confirmación
        } else {
          console.log("El usuario no ha confirmado la fecha.");
          // Realiza las acciones necesarias para la negativa
          return ctxFn.endFlow('La reserva fuecacelada')
        }
    }
  );





const dateFlow = addKeyword(EVENTS.ACTION)
    .addAnswer("Perfecto! Qué fecha quieres agendar?", { capture: true })
    .addAnswer("Revisando disponibilidad...", null,
        async (ctx, ctxFn) => {
            const currentDate = new Date();
            const solicitedDate = await text2iso(ctx.body)
            console.log("Fecha solicitada: " + solicitedDate)
            if (solicitedDate.includes("false")) {
                return ctxFn.endFlow("No se pudo deducir una fecha. Vuelve a preguntar")
            }
            const startDate = new Date(solicitedDate);
            console.log("Start Date: " + startDate)
            let dateAvailable = await isDateAvailable(startDate)
            console.log("Is date available: " + dateAvailable + " Type: " + typeof dateAvailable)

            if (dateAvailable === false) {
                const nextdateAvailable = await getNextAvailableSlot(startDate)
                console.log("Fecha recomendada: " + nextdateAvailable.start)
                const isoString = nextdateAvailable.start.toISOString();
                const dateText = await iso2text(isoString)
                console.log("Fecha texto: " + dateText)
                const messages = [{ role: "user", content: `${ctx.body}` }];
                const response = await chat(promptBase + "\nHoy es el dia: " + currentDate + "\nLa fecha solicitada es: " + solicitedDate + "\nLa disponibilidad de esa fecha es: false. El proximo espacio disponible que tienes que ofrecer es: " + dateText + "Da la fecha siempre en español", messages)
                await ctxFn.flowDynamic(response)
                await ctxFn.state.update({ date: nextdateAvailable.start });
                return ctxFn.gotoFlow(confirmationFlow)
            } else {
                const messages = [{ role: "user", content: `${ctx.body}` }];
                const response = await chat(promptBase + "\nHoy es el dia: " + currentDate + "\nLa fecha solicitada es: " + solicitedDate + "\nLa disponibilidad de esa fecha es: true" + "\nConfirmacions del cliente: No confirmo", messages)
                await ctxFn.flowDynamic(response)
                await ctxFn.state.update({ date: startDate });
                return ctxFn.gotoFlow(confirmationFlow)
            }
        })

module.exports = { dateFlow, confirmationFlow };

