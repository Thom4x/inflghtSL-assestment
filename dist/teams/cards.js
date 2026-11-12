"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildValidationCard = buildValidationCard;
exports.buildResultsCard = buildResultsCard;
function buildValidationCard(state, missingPaths) {
    const body = [
        {
            type: "TextBlock",
            text: "Asistente de Viajes Corporativos",
            weight: "Bolder",
            size: "Medium",
            color: "Accent",
        },
        {
            type: "TextBlock",
            text: `Tengo lista la base para **${state.flight?.passengers ?? "?"} pasajero(s)** (${state.flight?.originIata ?? "Origen"} → ${state.flight?.destinationIata ?? "Destino"}). Completa estos datos para cotizar:`,
            wrap: true,
        },
    ];
    if (missingPaths.includes("flight.returnDate")) {
        body.push({ type: "TextBlock", text: "**Fecha de regreso:**", wrap: true }, { type: "Input.Date", id: "returnDate" }, {
            type: "Input.Toggle",
            id: "isOneWay",
            title: "Es viaje solo de ida",
            value: "false",
            valueOn: "true",
            valueOff: "false",
        });
    }
    if (missingPaths.includes("flight.baggage")) {
        body.push({ type: "TextBlock", text: "**Equipaje en vuelo:**", wrap: true }, {
            type: "Input.ChoiceSet",
            id: "baggage",
            style: "expanded",
            value: "CARRY_ON_ONLY",
            choices: [
                { title: "Solo maleta de mano", value: "CARRY_ON_ONLY" },
                { title: "Incluir maleta en bodega", value: "CHECKED_BAG_INCLUDED" },
            ],
        });
    }
    if (missingPaths.includes("hotel.anchorLocation")) {
        body.push({
            type: "TextBlock",
            text: "**Zona o dirección de referencia para el hotel:**",
            wrap: true,
        }, {
            type: "Input.Text",
            id: "anchorLocation",
            placeholder: "Ej: Downtown, cerca de LAX, dirección oficina...",
        });
    }
    if (missingPaths.includes("hotel.checkOutDate") ||
        (state.hotel?.required && state.flight?.isOneWay && !state.hotel?.checkOutDate)) {
        body.push({ type: "TextBlock", text: "**Fecha de salida del hotel (Check-out):**", wrap: true }, { type: "Input.Date", id: "checkOutDate" });
    }
    if (state.hotel?.required && state.hotel?.includeBreakfast === null) {
        body.push({ type: "TextBlock", text: "**¿Incluimos desayuno en el hotel?**", wrap: true }, {
            type: "Input.ChoiceSet",
            id: "includeBreakfast",
            style: "expanded",
            value: "true",
            choices: [
                { title: "Sí, con desayuno (optimiza viáticos)", value: "true" },
                { title: "Solo habitación", value: "false" },
            ],
        });
    }
    return {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.5",
        body,
        actions: [
            {
                type: "Action.Submit",
                title: "Buscar y Cruzar Opciones",
                style: "positive",
            },
        ],
    };
}
function buildResultsCard(query, result) {
    const { bestFlight, bestHotel, crossPackage } = result;
    if (!bestFlight) {
        return {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.5",
            body: [
                {
                    type: "TextBlock",
                    text: "No se encontraron vuelos que cumplan con los límites operativos de escalas para estas fechas.",
                    wrap: true,
                },
            ],
        };
    }
    const body = [
        {
            type: "TextBlock",
            text: `Cotización Corporativa: ${query.flight.originIata} → ${query.flight.destinationIata}`,
            weight: "Bolder",
            size: "Large",
        },
        {
            type: "Container",
            style: "emphasis",
            items: [
                {
                    type: "TextBlock",
                    text: `✈️ MEJOR VUELO · ${bestFlight.airlineName} ${bestFlight.corporateCode ? `(${bestFlight.corporateCode})` : ""}`,
                    weight: "Bolder",
                },
                {
                    type: "TextBlock",
                    text: `Salida: ${bestFlight.departureIso.replace("T", " ")} | Llegada: ${bestFlight.arrivalIso.replace("T", " ")}`,
                    wrap: true,
                },
                {
                    type: "TextBlock",
                    text: `Total (${query.flight.passengers} pax): **$${bestFlight.netPrice} USD** (Ahorro convenio: $${bestFlight.savings} USD)`,
                    wrap: true,
                },
            ],
        },
    ];
    const actions = [
        {
            type: "Action.OpenUrl",
            title: `1. Reservar Vuelo (${bestFlight.airlineName})`,
            url: bestFlight.deepLink,
        },
    ];
    if (bestHotel && crossPackage) {
        body.push({
            type: "Container",
            style: "emphasis",
            items: [
                {
                    type: "TextBlock",
                    text: `🏨 MEJOR HOTEL · ${bestHotel.hotelName} (${bestHotel.distanceKm} km)`,
                    weight: "Bolder",
                    wrap: true,
                },
                {
                    type: "TextBlock",
                    text: `${query.hotel?.rooms} hab. individuales · ${bestHotel.hasBreakfast ? "Desayuno incluido" : "Solo habitación"} · Impuestos All-In`,
                    wrap: true,
                },
                {
                    type: "TextBlock",
                    text: `Total Hotel: **$${bestHotel.netPrice} USD** (Ahorro convenio: $${bestHotel.savings} USD)`,
                    wrap: true,
                },
            ],
        }, {
            type: "Container",
            style: "good",
            items: [
                {
                    type: "TextBlock",
                    text: "🎯 CRUCE ÓPTIMO VUELO + HOTEL",
                    weight: "Bolder",
                },
                {
                    type: "TextBlock",
                    text: `Costo Total Consolidado: **$${crossPackage.totalCorporate} USD** (Ahorro total: **$${crossPackage.totalSavings} USD**)`,
                    wrap: true,
                },
                {
                    type: "TextBlock",
                    text: crossPackage.earlyCheckInWarning,
                    size: "Small",
                    isSubtle: true,
                    wrap: true,
                },
            ],
        });
        actions.push({
            type: "Action.OpenUrl",
            title: "2. Reservar Hotel",
            url: bestHotel.deepLink,
        });
    }
    body.push({
        type: "TextBlock",
        text: "Tarifas sujetas a disponibilidad en tiempo real en las plataformas oficiales.",
        size: "Small",
        isSubtle: true,
        wrap: true,
    });
    return {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.5",
        body,
        actions,
    };
}
