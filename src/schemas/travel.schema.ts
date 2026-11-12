import { z } from "zod";

/**
 * 1. SUB-ESQUEMA DE VUELOS
 * Define estructura base, equipaje obligatorio y límites operativos de escalas.
 */
const FlightSearchSchema = z.object({
    originIata: z
        .string()
        .length(3)
        .toUpperCase()
        .describe("Código IATA de 3 letras del aeropuerto de origen (ej. MIA)"),
    destinationIata: z
        .string()
        .length(3)
        .toUpperCase()
        .describe("Código IATA de 3 letras del aeropuerto de destino (ej. LAX, DFW)"),
    departureDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato requerido: YYYY-MM-DD"),
    isOneWay: z.boolean().default(false),
    returnDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .describe("Obligatorio si isOneWay es false. Null si no fue especificado."),
    passengers: z.number().int().min(1).max(15),

    // Edge Case: Evitar tarifas básicas sin equipaje
    baggage: z
        .enum(["CARRY_ON_ONLY", "CHECKED_BAG_INCLUDED"])
        .nullable()
        .describe("Null si el usuario no indicó tipo de equipaje"),

    constraints: z
        .object({
            minLayoverMinutes: z.number().default(60),
            maxLayoverMinutes: z.number().default(240),
            allowAirportChangeOnLayover: z.boolean().default(false),
            flagRedEyeArrivals: z.boolean().default(true),
        })
        .default({}),
});

/**
 * 2. SUB-ESQUEMA DE HOTELES
 * Asegura anclaje geográfico, habitaciones individuales, impuestos All-In y facturación formal.
 */
const HotelSearchSchema = z.object({
    required: z.boolean().describe("True si el usuario solicita alojamiento o paquete completo"),
    anchorLocation: z
        .string()
        .min(3)
        .nullable()
        .describe("Zona, oficina o aeropuerto de referencia (ej. 'LAX Airport', 'Downtown'). Null si no se indicó."),
    searchRadiusKm: z.number().min(1).max(25).default(8),

    checkInDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .describe("Fecha de entrada al hotel (YYYY-MM-DD). Por defecto coincide con departureDate."),
    checkOutDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .describe("Fecha de salida del hotel (YYYY-MM-DD). Null si el vuelo es solo ida y no se indicó noches."),

    // Edge Case: 1 habitación individual por pasajero por defecto
    rooms: z.number().int().min(1),
    shareRooms: z.boolean().default(false),

    // Edge Cases: Viáticos, flexibilidad y compliance contable
    includeBreakfast: z
        .boolean()
        .nullable()
        .describe("Null si no se ha confirmado si requiere desayuno"),
    preferFreeCancellation: z.boolean().default(true),
    requireAllInPricing: z.boolean().default(true),
    minStarRating: z.number().min(3).max(5).default(3),
    formalHotelsOnly: z.boolean().default(true),
    require24hReception: z.boolean().default(true),
});

/**
 * 3. ESQUEMA DE EXTRACCIÓN DEL AGENTE 1 (GROQ)
 * Permite campos parciales o en null para no forzar al LLM a inventar datos faltantes.
 */
export const TravelExtractionSchema = z.object({
    flight: FlightSearchSchema.partial({
        originIata: true,
        destinationIata: true,
        departureDate: true,
        passengers: true,
    }),
    hotel: HotelSearchSchema.partial({
        anchorLocation: true,
        checkInDate: true,
        checkOutDate: true,
        rooms: true,
    }).nullable(),
    ambiguousLocations: z
        .array(z.string())
        .default([])
        .describe("Ciudades con múltiples aeropuertos o ambigüedad geográfica"),
});

/**
 * 4. ESQUEMA ESTRICTO DE EJECUCIÓN (PRE-API)
 * Valida reglas cruzadas y dispara los paths exactos que renderiza cards.ts si falta algo.
 */
export const StrictTravelExecutionSchema = z
    .object({
        flight: FlightSearchSchema,
        hotel: HotelSearchSchema.nullable(),
    })
    .superRefine((data, ctx) => {
        // Regla 1: Validar fecha de regreso en viajes redondos
        if (!data.flight.isOneWay) {
            if (!data.flight.returnDate) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["flight", "returnDate"],
                    message: "Falta la fecha de regreso para vuelo redondo.",
                });
            } else if (data.flight.returnDate < data.flight.departureDate) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["flight", "returnDate"],
                    message: "La fecha de regreso no puede ser anterior a la de ida.",
                });
            }
        }

        // Regla 2: Equipaje obligatorio
        if (data.flight.baggage === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["flight", "baggage"],
                message: "Debe definir si requiere maleta de mano o equipaje en bodega.",
            });
        }

        // Regla 3: Validaciones cruzadas de hotel
        if (data.hotel?.required) {
            if (!data.hotel.anchorLocation) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["hotel", "anchorLocation"],
                    message: "Falta la zona o punto de referencia para ubicar el hotel.",
                });
            }

            if (!data.hotel.checkInDate) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["hotel", "checkInDate"],
                    message: "Falta la fecha de check-in del hotel.",
                });
            }

            if (!data.hotel.checkOutDate) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["hotel", "checkOutDate"],
                    message: "Falta la fecha de check-out del hotel.",
                });
            } else if (
                data.hotel.checkInDate &&
                data.hotel.checkOutDate <= data.hotel.checkInDate
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["hotel", "checkOutDate"],
                    message: "El check-out debe ser posterior al check-in.",
                });
            }

            if (data.hotel.includeBreakfast === null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["hotel", "includeBreakfast"],
                    message: "Debe confirmar si desea incluir desayuno en el hotel.",
                });
            }

            if (!data.hotel.shareRooms && data.hotel.rooms < data.flight.passengers) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["hotel", "rooms"],
                    message: "Por política operativa se requiere 1 habitación por pasajero.",
                });
            }
        }
    })
    // Garantiza tipos string no-nulos en checkInDate y checkOutDate tras pasar superRefine
    .transform((data) => {
        if (!data.hotel || !data.hotel.required) {
            return { flight: data.flight, hotel: null };
        }
        return {
            flight: data.flight,
            hotel: {
                ...data.hotel,
                checkInDate: data.hotel.checkInDate!,
                checkOutDate: data.hotel.checkOutDate!,
            },
        };
    });

export type TravelExtraction = z.infer<typeof TravelExtractionSchema>;
export type TravelExtractionState = Omit<Partial<TravelExtraction>, "flight" | "hotel"> & {
    flight?: Partial<TravelExtraction["flight"]>;
    hotel?: Partial<NonNullable<TravelExtraction["hotel"]>> | null;
};
export type StrictTravelExecution = z.infer<typeof StrictTravelExecutionSchema>;