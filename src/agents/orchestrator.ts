import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { conveniosCorporativos, historialCotizaciones, sesionesChat } from "../db/schema";
import {
    StrictTravelExecutionSchema,
    TravelExtraction,
    TravelExtractionSchema,
    TravelExtractionState,
} from "../schemas/travel.schema";
import { evaluateAndCrossOptimize } from "../services/optimizer";
import { fetchMockFlights, fetchMockHotels } from "../services/providers.mock";
import { buildResultsCard, buildValidationCard } from "../teams/cards";
import { env } from "../config/env";
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function processTravelTurn(params: {
    conversationId: string;
    userId: string;
    userText?: string;
    cardSubmitData?: Record<string, unknown>;
}) {
    const { conversationId, userId, userText, cardSubmitData } = params;

    // 1. Recuperar sesión previa en PostgreSQL si existe
    const [existingSession] = await db
        .select()
        .from(sesionesChat)
        .where(eq(sesionesChat.conversationId, conversationId));

    let mergedState: TravelExtractionState =
        (existingSession?.datosExtraidos as TravelExtractionState) ?? {};

    // 2A. Si el usuario respondió mediante botones de Adaptive Card
    if (cardSubmitData) {
        mergedState = deepMergeCardInputs(mergedState, cardSubmitData);
    }

    // 2B. Si el usuario escribió en lenguaje natural, extrae Groq (Llama 3.3 70B)
    if (userText && userText.trim().length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { object: extracted } = await generateObject<TravelExtraction>({
            model: groq(env.GROQ_MODEL),
            schema: TravelExtractionSchema,
            prompt: `Fecha actual: ${today}.
Contexto previo de la conversación: ${JSON.stringify(mergedState)}.
Nuevo mensaje del usuario: "${userText}".
Extrae y actualiza los datos de vuelo y hotel. Si un dato obligatorio no fue mencionado ni está en el contexto previo, déjalo estrictamente en null. Si menciona hotel pero no habitaciones, asigna rooms = passengers.`,
        });
        mergedState = extracted;
    }

    // 3. Validación estricta con Zod antes de tocar APIs de viajes
    const validation = StrictTravelExecutionSchema.safeParse(mergedState);

    if (!validation.success) {
        await db
            .insert(sesionesChat)
            .values({
                conversationId,
                userId,
                datosExtraidos: mergedState,
                estado: "ESPERANDO_DATOS",
            })
            .onConflictDoUpdate({
                target: sesionesChat.conversationId,
                set: { datosExtraidos: mergedState, actualizadoEn: new Date() },
            });

        const missingPaths = validation.error.issues.map((i) => i.path.join("."));
        return {
            type: "CARD",
            card: buildValidationCard(mergedState, missingPaths),
        };
    }

    // 4. Esquema 100% válido -> Búsqueda paralela + Convenios desde PostgreSQL
    const validQuery = validation.data;

    const [activeConvenios, flights, hotels] = await Promise.all([
        db.select().from(conveniosCorporativos).where(eq(conveniosCorporativos.activo, true)),
        fetchMockFlights(validQuery.flight),
        validQuery.hotel?.required ? fetchMockHotels(validQuery.hotel) : Promise.resolve([]),
    ]);

    // 5. Optimización determinista y cruce Vuelo + Hotel
    const result = evaluateAndCrossOptimize(validQuery, flights, hotels, activeConvenios);

    // 6. Auditoría silenciosa y cierre de sesión
    if (result.bestFlight) {
        const totalPublic = result.crossPackage?.totalPublic ?? result.bestFlight.publicWithBags;
        const totalCorp = result.crossPackage?.totalCorporate ?? result.bestFlight.netPrice;
        const totalSavings = result.crossPackage?.totalSavings ?? result.bestFlight.savings;

        await Promise.all([
            db.insert(historialCotizaciones).values({
                usuarioId: userId,
                ruta: `${validQuery.flight.originIata}-${validQuery.flight.destinationIata}`,
                pasajeros: validQuery.flight.passengers,
                costoPublicoTotal: totalPublic.toString(),
                costoCorporativoTotal: totalCorp.toString(),
                ahorroGenerado: totalSavings.toString(),
                detalleOpciones: result,
            }),
            db
                .update(sesionesChat)
                .set({ datosExtraidos: validQuery, estado: "COMPLETADO", actualizadoEn: new Date() })
                .where(eq(sesionesChat.conversationId, conversationId)),
        ]);
    }

    return {
        type: "CARD",
        card: buildResultsCard(validQuery, result),
    };
}

function deepMergeCardInputs(
    state: TravelExtractionState,
    inputs: Record<string, unknown>
): TravelExtractionState {
    const updated = structuredClone(state);
    const flight = updated.flight ?? {};

    if (inputs.isOneWay === "true") {
        flight.isOneWay = true;
        flight.returnDate = null;
    } else if (inputs.returnDate) {
        flight.isOneWay = false;
        flight.returnDate = String(inputs.returnDate);
    }

    if (inputs.baggage) {
        flight.baggage = inputs.baggage as "CARRY_ON_ONLY" | "CHECKED_BAG_INCLUDED";
    }

    updated.flight = flight;

    if (updated.hotel?.required) {
        const hotel = updated.hotel;

        if (flight.departureDate && !hotel.checkInDate) {
            hotel.checkInDate = flight.departureDate;
        }
        if (inputs.checkOutDate) {
            hotel.checkOutDate = String(inputs.checkOutDate);
        } else if (flight.returnDate && !hotel.checkOutDate) {
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