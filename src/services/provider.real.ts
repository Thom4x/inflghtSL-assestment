import { env } from "../config/env";
import { StrictTravelExecution } from "../schemas/travel.schema";
import { FlightOffer, HotelOffer } from "./optimizer";

// Caché en memoria (15 min) para no gastar cuota de SerpApi en consultas repetidas
const cache = new Map<string, { expiresAt: number; data: unknown }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached<T>(key: string): T | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        cache.delete(key);
        return null;
    }
    return hit.data as T;
}

function setCached(key: string, data: unknown) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

function toIsoDateTime(raw: string, fallbackDate: string): string {
    if (!raw) return `${fallbackDate}T12:00:00`;
    const normalized = raw.trim().replace(" ", "T");
    return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function inferAirlineCode(flightNumber?: string, airlineName = ""): string {
    // Ej: "AA 1420" -> "AA"
    const prefix = flightNumber?.trim().split(/\s+/)[0]?.toUpperCase();
    if (prefix && /^[A-Z0-9]{2}$/.test(prefix)) return prefix;

    const name = airlineName.toLowerCase();
    if (name.includes("american")) return "AA";
    if (name.includes("avianca")) return "AV";
    if (name.includes("latam")) return "LA";
    if (name.includes("copa")) return "CM";
    if (name.includes("united")) return "UA";
    if (name.includes("delta")) return "DL";
    if (name.includes("jetblue")) return "B6";
    if (name.includes("spirit")) return "NK";
    if (name.includes("iberia")) return "IB";
    return "OTHER";
}

function inferHotelChainCode(hotelName: string): string {
    const name = hotelName.toLowerCase();
    if (
        name.includes("hilton") ||
        name.includes("embassy suites") ||
        name.includes("hampton") ||
        name.includes("doubletree")
    ) {
        return "HILTON";
    }
    if (
        name.includes("marriott") ||
        name.includes("courtyard") ||
        name.includes("sheraton") ||
        name.includes("westin") ||
        name.includes("fairfield")
    ) {
        return "MARRIOTT";
    }
    if (
        name.includes("holiday inn") ||
        name.includes("intercontinental") ||
        name.includes("crowne plaza")
    ) {
        return "IHG";
    }
    if (name.includes("hyatt")) return "HYATT";
    if (name.includes("nh ") || name.startsWith("nh")) return "NH";
    if (name.includes("ibis") || name.includes("novotel") || name.includes("sofitel")) {
        return "ACCOR";
    }
    return "INDEPENDENT";
}

export async function fetchRealFlights(
    flight: StrictTravelExecution["flight"]
): Promise<FlightOffer[]> {
    const cacheKey = `flights:${JSON.stringify(flight)}`;
    const cached = getCached<FlightOffer[]>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
        engine: "google_flights",
        departure_id: flight.originIata,
        arrival_id: flight.destinationIata,
        outbound_date: flight.departureDate,
        type: flight.isOneWay ? "2" : "1", // 1 = Redondo, 2 = Solo ida
        adults: String(flight.passengers),
        currency: "USD",
        hl: "es",
        api_key: env.SERPAPI_KEY,
    });

    if (!flight.isOneWay && flight.returnDate) {
        params.set("return_date", flight.returnDate);
    }

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Error SerpApi Flights (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
        best_flights?: any[];
        other_flights?: any[];
        search_metadata?: { google_flights_url?: string };
    };

    const rawOptions = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
    const fallbackDeepLink =
        data.search_metadata?.google_flights_url ??
        `https://www.google.com/travel/flights?q=Flights+from+${flight.originIata}+to+${flight.destinationIata}+on+${flight.departureDate}`;

    const offers: FlightOffer[] = rawOptions
        .filter((opt) => Array.isArray(opt.flights) && opt.flights.length > 0 && typeof opt.price === "number")
        .map((opt, idx) => {
            const legs = opt.flights;
            const firstLeg = legs[0];
            const lastLeg = legs[legs.length - 1];

            // Verificar si cambia de aeropuerto durante alguna escala
            let changesAirportOnLayover = false;
            for (let i = 0; i < legs.length - 1; i++) {
                if (legs[i]?.arrival_airport?.id !== legs[i + 1]?.departure_airport?.id) {
                    changesAirportOnLayover = true;
                    break;
                }
            }

            // Tomar la escala más crítica si existen escalas
            const layovers: Array<{ duration?: number }> = opt.layovers ?? [];
            let layoverMinutes = 0;
            if (layovers.length > 0) {
                const durations = layovers.map((l) => l.duration ?? 0);
                const invalidShort = durations.find((d) => d > 0 && d < 60);
                const invalidLong = durations.find((d) => d > 240);
                layoverMinutes = invalidShort ?? invalidLong ?? Math.max(...durations);
            }

            const extensionsText = (opt.extensions ?? []).join(" ").toLowerCase();
            const freeBagIncluded =
                extensionsText.includes("free checked bag") ||
                extensionsText.includes("maleta documentada gratis") ||
                extensionsText.includes("equipaje facturado gratis");

            const airlineName = firstLeg.airline ?? "Aerolínea";
            const airlineCode = inferAirlineCode(firstLeg.flight_number, airlineName);

            return {
                id: `serp-fl-${idx}-${airlineCode}`,
                airlineCode,
                airlineName,
                departureIso: toIsoDateTime(firstLeg.departure_airport?.time, flight.departureDate),
                arrivalIso: toIsoDateTime(lastLeg.arrival_airport?.time, flight.departureDate),
                layoverMinutes,
                changesAirportOnLayover,
                publicTotalPrice: opt.price,
                checkedBagFeePerPax: freeBagIncluded ? 0 : 35,
                deepLink: fallbackDeepLink,
            };
        });

    setCached(cacheKey, offers);
    return offers;
}

export async function fetchRealHotels(
    hotel: NonNullable<StrictTravelExecution["hotel"]>,
    destinationIata: string
): Promise<HotelOffer[]> {
    const cacheKey = `hotels:${destinationIata}:${JSON.stringify(hotel)}`;
    const cached = getCached<HotelOffer[]>(cacheKey);
    if (cached) return cached;

    const nights = Math.max(
        1,
        Math.round(
            (new Date(hotel.checkOutDate).getTime() - new Date(hotel.checkInDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
    );

    const params = new URLSearchParams({
        engine: "google_hotels",
        q: `Hotels near ${hotel.anchorLocation} ${destinationIata}`,
        check_in_date: hotel.checkInDate,
        check_out_date: hotel.checkOutDate,
        adults: "1", // Cotizamos base por habitación individual y multiplicamos por hotel.rooms
        currency: "USD",
        gl: "us",
        hl: "es",
        api_key: env.SERPAPI_KEY,
    });

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Error SerpApi Hotels (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
        properties?: any[];
        search_metadata?: { google_hotels_url?: string };
    };

    const fallbackDeepLink =
        data.search_metadata?.google_hotels_url ??
        `https://www.google.com/travel/hotels?q=${encodeURIComponent(
            `${hotel.anchorLocation} ${destinationIata}`
        )}`;

    const offers: HotelOffer[] = (data.properties ?? [])
        // Cumplimiento fiscal: excluir alquileres vacacionales / apartamentos informales
        .filter((p) => p.type !== "vacation rental")
        .filter((p) => !p.hotel_class || p.hotel_class >= hotel.minStarRating)
        .map((p, idx) => {
            const totalSingleRoom =
                p.total_rate?.extracted_lowest ??
                (p.rate_per_night?.extracted_lowest
                    ? p.rate_per_night.extracted_lowest * nights
                    : null);

            if (!totalSingleRoom) return null;

            const amenities: string[] = (p.amenities ?? []).map((a: string) => a.toLowerCase());
            const includesBreakfastByDefault = amenities.some(
                (a) => a.includes("breakfast") || a.includes("desayuno")
            );
            const has24hReception =
                amenities.some((a) => a.includes("24-hour front desk") || a.includes("recepción 24")) ||
                (p.hotel_class ?? 3) >= 3;
            const freeCancellation =
                Boolean(p.free_cancellation) ||
                amenities.some((a) => a.includes("free cancellation") || a.includes("cancelación gratuita"));

            // Google Hotels ordena por cercanía al punto ancla; estimamos radio gradual por posición
            const estimatedDistanceKm = Number((1.2 + idx * 0.7).toFixed(1));

            return {
                id: `serp-ht-${idx}`,
                chainCode: inferHotelChainCode(p.name ?? ""),
                hotelName: p.name ?? "Hotel Corporativo",
                distanceKm: estimatedDistanceKm,
                has24hReception,
                includesBreakfastByDefault,
                freeCancellation,
                publicTotalAllInPrice: Number((totalSingleRoom * hotel.rooms).toFixed(2)),
                deepLink: p.link ?? fallbackDeepLink,
            };
        })
        .filter((item): item is HotelOffer => item !== null);

    setCached(cacheKey, offers);
    return offers;
}