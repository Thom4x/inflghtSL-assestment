"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTravelTurn = processTravelTurn;
const groq_1 = require("@ai-sdk/groq");
const ai_1 = require("ai");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const travel_schema_1 = require("../schemas/travel.schema");
const optimizer_1 = require("../services/optimizer");
const providers_mock_1 = require("../services/providers.mock");
const cards_1 = require("../teams/cards");
const groq = (0, groq_1.createGroq)({ apiKey: process.env.GROQ_API_KEY });
async function processTravelTurn(params) {
    const { conversationId, userId, userText, cardSubmitData } = params;
    // 1. Recuperar sesión previa en PostgreSQL si existe
    const [existingSession] = await db_1.db
        .select()
        .from(schema_1.sesionesChat)
        .where((0, drizzle_orm_1.eq)(schema_1.sesionesChat.conversationId, conversationId));
    let mergedState = existingSession?.datosExtraidos ?? {};
    // 2A. Si el usuario respondió mediante botones de Adaptive Card
    if (cardSubmitData) {
        mergedState = deepMergeCardInputs(mergedState, cardSubmitData);
    }
    // 2B. Si el usuario escribió en lenguaje natural, extrae Groq (Llama 3.3 70B)
    if (userText && userText.trim().length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { object: extracted } = await (0, ai_1.generateObject)({
            model: groq("llama-3.3-70b-versatile"),
            schema: travel_schema_1.TravelExtractionSchema,
            prompt: `Fecha actual: ${today}.
Contexto previo de la conversación: ${JSON.stringify(mergedState)}.
Nuevo mensaje del usuario: "${userText}".
Extrae y actualiza los datos de vuelo y hotel. Si un dato obligatorio no fue mencionado ni está en el contexto previo, déjalo estrictamente en null. Si menciona hotel pero no habitaciones, asigna rooms = passengers.`,
        });
        mergedState = extracted;
    }
    // 3. Validación estricta con Zod antes de tocar APIs de viajes
    const validation = travel_schema_1.StrictTravelExecutionSchema.safeParse(mergedState);
    if (!validation.success) {
        await db_1.db
            .insert(schema_1.sesionesChat)
            .values({
            conversationId,
            userId,
            datosExtraidos: mergedState,
            estado: "ESPERANDO_DATOS",
        })
            .onConflictDoUpdate({
            target: schema_1.sesionesChat.conversationId,
            set: { datosExtraidos: mergedState, actualizadoEn: new Date() },
        });
        const missingPaths = validation.error.issues.map((i) => i.path.join("."));
        return {
            type: "CARD",
            card: (0, cards_1.buildValidationCard)(mergedState, missingPaths),
        };
    }
    // 4. Esquema 100% válido -> Búsqueda paralela + Convenios desde PostgreSQL
    const validQuery = validation.data;
    const [activeConvenios, flights, hotels] = await Promise.all([
        db_1.db.select().from(schema_1.conveniosCorporativos).where((0, drizzle_orm_1.eq)(schema_1.conveniosCorporativos.activo, true)),
        (0, providers_mock_1.fetchMockFlights)(validQuery.flight),
        validQuery.hotel?.required ? (0, providers_mock_1.fetchMockHotels)(validQuery.hotel) : Promise.resolve([]),
    ]);
    // 5. Optimización determinista y cruce Vuelo + Hotel
    const result = (0, optimizer_1.evaluateAndCrossOptimize)(validQuery, flights, hotels, activeConvenios);
    // 6. Auditoría silenciosa y cierre de sesión
    if (result.bestFlight) {
        const totalPublic = result.crossPackage?.totalPublic ?? result.bestFlight.publicWithBags;
        const totalCorp = result.crossPackage?.totalCorporate ?? result.bestFlight.netPrice;
        const totalSavings = result.crossPackage?.totalSavings ?? result.bestFlight.savings;
        await Promise.all([
            db_1.db.insert(schema_1.historialCotizaciones).values({
                usuarioId: userId,
                ruta: `${validQuery.flight.originIata}-${validQuery.flight.destinationIata}`,
                pasajeros: validQuery.flight.passengers,
                costoPublicoTotal: totalPublic.toString(),
                costoCorporativoTotal: totalCorp.toString(),
                ahorroGenerado: totalSavings.toString(),
                detalleOpciones: result,
            }),
            db_1.db
                .update(schema_1.sesionesChat)
                .set({ datosExtraidos: validQuery, estado: "COMPLETADO", actualizadoEn: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.sesionesChat.conversationId, conversationId)),
        ]);
    }
    return {
        type: "CARD",
        card: (0, cards_1.buildResultsCard)(validQuery, result),
    };
}
function deepMergeCardInputs(state, inputs) {
    const updated = structuredClone(state);
    const flight = updated.flight ?? {};
    if (inputs.isOneWay === "true") {
        flight.isOneWay = true;
        flight.returnDate = null;
    }
    else if (inputs.returnDate) {
        flight.isOneWay = false;
        flight.returnDate = String(inputs.returnDate);
    }
    if (inputs.baggage) {
        flight.baggage = inputs.baggage;
    }
    updated.flight = flight;
    if (updated.hotel?.required) {
        const hotel = updated.hotel;
        if (flight.departureDate && !hotel.checkInDate) {
            hotel.checkInDate = flight.departureDate;
        }
        if (inputs.checkOutDate) {
            hotel.checkOutDate = String(inputs.checkOutDate);
        }
        else if (flight.returnDate && !hotel.checkOutDate) {
            hotel.checkOutDate = flight.returnDate;
        }
        if (inputs.anchorLocation) {
            hotel.anchorLocation = String(inputs.anchorLocation);
        }
        if (inputs.includeBreakfast !== undefined) {
            hotel.includeBreakfast = inputs.includeBreakfast === "true";
        }
    }
    return updated;
}
