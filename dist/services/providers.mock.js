"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMockFlights = fetchMockFlights;
exports.fetchMockHotels = fetchMockHotels;
async function fetchMockFlights(flight) {
    const { originIata, destinationIata, departureDate, passengers } = flight;
    const buildUrl = (airline) => {
        const params = new URLSearchParams({
            origin: originIata,
            destination: destinationIata,
            date: departureDate,
            adults: String(passengers),
        });
        return `https://www.google.com/travel/flights?${params.toString()}`;
    };
    return [
        {
            id: "fl-aa-101",
            airlineCode: "AA",
            airlineName: "American Airlines",
            departureIso: `${departureDate}T09:00:00`,
            arrivalIso: `${departureDate}T11:45:00`,
            layoverMinutes: 0,
            changesAirportOnLayover: false,
            publicTotalPrice: 235 * passengers,
            checkedBagFeePerPax: 35,
            deepLink: buildUrl("AA"),
        },
        {
            id: "fl-nk-202",
            airlineCode: "NK",
            airlineName: "Spirit Airlines",
            departureIso: `${departureDate}T21:30:00`,
            arrivalIso: `${departureDate}T02:15:00`, // Simula cruce de medianoche en optimizer
            layoverMinutes: 110,
            changesAirportOnLayover: false,
            publicTotalPrice: 175 * passengers,
            checkedBagFeePerPax: 45,
            deepLink: buildUrl("NK"),
        },
        {
            // Caso inválido: escala menor a 60 min (debe ser descartado por optimizer.ts)
            id: "fl-bad-303",
            airlineCode: "UA",
            airlineName: "United Airlines",
            departureIso: `${departureDate}T07:00:00`,
            arrivalIso: `${departureDate}T12:10:00`,
            layoverMinutes: 35,
            changesAirportOnLayover: false,
            publicTotalPrice: 160 * passengers,
            checkedBagFeePerPax: 35,
            deepLink: buildUrl("UA"),
        },
    ];
}
async function fetchMockHotels(hotel) {
    const { anchorLocation, checkInDate, checkOutDate, rooms } = hotel;
    const nights = Math.max(1, Math.round((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
    const buildUrl = (hotelName) => {
        const params = new URLSearchParams({
            q: `${hotelName} near ${anchorLocation}`,
            checkin: checkInDate,
            checkout: checkOutDate,
            rooms: String(rooms),
        });
        return `https://www.google.com/travel/hotels?${params.toString()}`;
    };
    return [
        {
            id: "ht-hilton-1",
            chainCode: "HILTON",
            hotelName: `Embassy Suites by Hilton (${anchorLocation})`,
            distanceKm: 2.4,
            has24hReception: true,
            includesBreakfastByDefault: true,
            freeCancellation: true,
            publicTotalAllInPrice: 200 * rooms * nights,
            deepLink: buildUrl("Embassy Suites by Hilton"),
        },
        {
            id: "ht-ind-2",
            chainCode: "INDEPENDENT",
            hotelName: `Executive Inn (${anchorLocation})`,
            distanceKm: 3.1,
            has24hReception: true,
            includesBreakfastByDefault: false,
            freeCancellation: false,
            publicTotalAllInPrice: 165 * rooms * nights,
            deepLink: buildUrl("Executive Inn"),
        },
        {
            // Caso inválido: fuera del radio máximo de búsqueda (debe ser descartado)
            id: "ht-far-3",
            chainCode: "MARRIOTT",
            hotelName: "Suburban Suites Far Away",
            distanceKm: 18.5,
            has24hReception: true,
            includesBreakfastByDefault: true,
            freeCancellation: true,
            publicTotalAllInPrice: 120 * rooms * nights,
            deepLink: buildUrl("Suburban Suites"),
        },
    ];
}
