require("dotenv").config();
const { google } = require('googleapis');

// Inicializa la libreria cliente de google y configura la autentificacion
const auth = new google.auth.GoogleAuth({
    keyFile: './google.json', //Ruta al archivo de clave de tu cuenta de servicio
    scopes: ['https://www.googleapis.com/auth/calendar']
});

const calendar = google.calendar({ version: "v3", auth });

// Constantes configurables
const calendarId = process.env.CALENDAR_ID;
const timeZone = 'America/Mexico_City';

const rangeLimit = {
    days: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 18,
};

const standardDuration = 1; //Duracion por defecto de la cita
const dateLimit = 30; // Maximo de dias a traer la lista 

/**
 * Crea un evento en el calendario
 * @param {string} eventName - Nombre del evento.
 * @param {string} description - Descripcion del evento.
 * @param {string} date - Fecha y hora de inicio del evento en formato ISO
 * @param {number} [duration=standardDuration] - Duracion del evento en horas. Default 1 hora.
 * @returns {string} - URL de la invitacion al evento
 */

async function createEvent(eventName, description, date, duration = standardDuration) {
    try{
        // Autenticacion
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        // Fecha y hora de inicio del evento
        const startDateTime = new Date(date);
        // Fecha y hora de fin del evento
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(startDateTime.getHours() + duration);

        const event = {
            summary: eventName,
            description: description,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: timeZone,
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: timeZone,
            },
            colorID: 2, // El ID del color verde en Google calendar
        };

        const response = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
        });
        return response
    } catch (err) {
        console.error('Hubo un error al crear el evento en el servidor de Calendar:', err);
        throw err;
    }
}

/**
 * Lista de slots disponibles entre las fechas dadas.
 * @param {Date} [startDate=new Date()] - Fecha de inicio para buscar slots disponibles. Deafult la siguiente hora.
 * @param {Date} [endDate] - Fecha de fin para buscar slots disponibles. Default es el maximo definido.
 * @returns {Array} - Lista de slots disponibles.
 */
async function listAvailableSlots(startDate = new Date(), endDate) {
    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        // Definir fecha de fin si no se proporciona
        if (!endDate) {
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + dateLimit);
        }

        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            timeZone: timeZone,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items;
        const slots = [];
        let currentDate = new Date(startDate);

        // Generar slots disponibles basados en rangeList
        while (currentDate < endDate){
            const dayOfWeek = currentDate.getDay();
            if (rangeLimit.days.includes(dayOfWeek)) {
                for (let hour = rangeLimit.startHour; hour < rangeLimit.endHour; hour++) {
                    const slotStart = new Date(currentDate);
                    slotStart.setHours(hour, 0, 0, 0);
                    const slotEnd = new Date(slotStart);
                    slotEnd.setHours(hour + standardDuration);

                    const isBusy = events.some(event => {
                        const eventStart = new Date(event.start.dateTime || event.start.date);
                        const eventEnd = new Date(event.end.dateTime || event.end.date);
                    
                        // Verifica si hay una superposición entre el slot y el evento
                        return (slotStart < eventEnd && slotEnd > eventStart);
                    });
                    

                    if (!isBusy) {
                        slots.push({ start: slotStart, end: slotEnd });
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return slots;
    } catch (err){
        console.error('Hubo un error al conectar el servicio de Calendar: ' + err);
        throw err;
    }
}

/**
 * Obtiene el proximo slot disponible a partir de la fecha dadad.
 * @param {string|Date} date - Fecha a partir de la cual buscar el proximo slot disponible, puede ser
 * @returns {Object|null} - El proximo slot disponible o null si no hay ninguno.
 */

async function getNextAvailableSlot(date) {
    try {
        // Verificar si date es un string en formato ISO
        if (typeof date === 'string') {
            // Convertir el string ISO en un objeto Date
            date = new Date(date);
        } else if (!(date instanceof Date) || isNaN(date)) {
            throw new Error('La fecha proporcionada no es valida.')
        }

        // Obtener el proximo slot disponible
        const availableSlots = await listAvailableSlots(date);

        // Filtrar slots disponibles que comienzan despues de la fecha proporcionada
        const filteredSlots = availableSlots.filter(slot => new Date(slot.start) > date);

        // Ordenar los slots por su hora de inicio en orden ascendente
        const sortedSlots = filteredSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

        // Tomar el primer slot de la lista resultante, que sera el slot disponible
        return sortedSlots.length > 0 ? sortedSlots[0] : null;
    } catch (err){ 
        console.error('Hubo un error al obtener el proximo slot disponible' + err);
        throw err;
    }
}



/**
 * Verifica si hay slots disponibles para una fecha dada
 * @param {Date} date - Fecha a verificar.
 * @returns {boolean} - Devuelve true si hay slots disponibles dentro del rango permitido, false en caso de que no haya disponibles
 */
async function isDateAvailable(date) {
    try{
        // Validar que la fecha este dentro del rango permitido
        const currentDate = new Date();
        const maxDate = new Date(currentDate);
        maxDate.setDate(currentDate.getDate() + dateLimit);

        if (date < currentDate || date > maxDate){
            return false; // La fecha  esta fuera del rango permitido
        }

        // Verifica que la fecha caiga en un dia permitido
        const dayOfWeek = date.getDay();
        if (!rangeLimit.days.includes(dayOfWeek)) {
            return false; // La fecha no esta dentro de los dias permitidos 
        }

        // Verifica que la hora este dentro del rango permitido 
        const hour = date.getHours();
        if (hour < rangeLimit.startHour || hour >= rangeLimit.endHour) {
            return false; // La hora no esta dentro del rango permitido
        }

        // Obtener todos los slots disponibles desde la fecha actual hasta el limite definido
        const availableSlots = await listAvailableSlots(currentDate);

        // Filtrar slots disponibles basados en la fecha dada
        const slotsOnGivenDate = availableSlots.filter(slot => new Date(slot.start).toDateString() === date.toDateString());

        // Verificar si hay slots disponibles en la fecha dada.
        const isSlotAvailable = slotsOnGivenDate.some(slot =>
            new Date(slot.start).getTime() === date.getTime() && 
            new Date(slot.end).getTime() === date.getTime() + standardDuration * 60 * 60 * 1000
        );

        return isSlotAvailable;
    } catch (err){
        console.error('Hubo un error al verificar disponibilidad de la fecha ' + err);
        throw err;
    }
}

module.exports = { createEvent, isDateAvailable, getNextAvailableSlot };