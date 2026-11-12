"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAndCrossOptimize = evaluateAndCrossOptimize;
const luxon_1 = require("luxon");
function evaluateAndCrossOptimize(query, rawFlights, rawHotels, convenios) {
    // 1. Filtrar y calcular precio neto de vuelos
    const validFlights = rawFlights
        .filter((f) => {
        if (f.changesAirportOnLayover)
            return false;
        if (f.layoverMinutes > 0 && (f.layoverMinutes < 60 || f.layoverMinutes > 240))
            return false;
        return true;
    })
        .map((f) => {
        const conv = convenios.find((c) => c.tipoProveedor === "AEROLINEA" && c.codigoIdentificador === f.airlineCode);
        const discountRate = conv ? Number(conv.descuentoPorcentaje) / 100 : 0;
        const needsBag = query.flight.baggage === "CHECKED_BAG_INCLUDED";
        const bagCost = needsBag && !conv?.maletaBodegaGratis
            ? f.checkedBagFeePerPax * query.flight.passengers
            : 0;
        const publicWithBags = f.publicTotalPrice + (needsBag ? f.checkedBagFeePerPax * query.flight.passengers : 0);
        const netPrice = Number((f.publicTotalPrice * (1 - discountRate) + bagCost).toFixed(2));
        const dep = luxon_1.DateTime.fromISO(f.departureIso);
        const arr = luxon_1.DateTime.fromISO(f.arrivalIso);
        const isRedEyeNextDay = arr.day !== dep.day;
        return {
            ...f,
            publicWithBags,
            netPrice,
            savings: Number((publicWithBags - netPrice).toFixed(2)),
            corporateCode: conv?.codigoConvenio ?? null,
            isRedEyeNextDay,
        };
    })
        .sort((a, b) => a.netPrice - b.netPrice);
    const bestFlight = validFlights[0];
    // Si no requiere hotel, retornamos solo vuelos
    if (!query.hotel?.required || !bestFlight) {
        return { bestFlight, bestHotel: null, crossPackage: null };
    }
    // 2. Filtrar y calcular precio neto de hoteles
    const arrivalHour = luxon_1.DateTime.fromISO(bestFlight.arrivalIso).hour;
    const arrivesLateNight = arrivalHour >= 21 || arrivalHour <= 4;
    const validHotels = rawHotels
        .filter((h) => {
        if (h.distanceKm > (query.hotel?.searchRadiusKm ?? 8))
            return false;
        if (arrivesLateNight && !h.has24hReception)
            return false;
        return true;
    })
        .map((h) => {
        const conv = convenios.find((c) => c.tipoProveedor === "HOTEL" && c.codigoIdentificador === h.chainCode);
        const discountRate = conv ? Number(conv.descuentoPorcentaje) / 100 : 0;
        const netPrice = Number((h.publicTotalAllInPrice * (1 - discountRate)).toFixed(2));
        return {
            ...h,
            netPrice,
            savings: Number((h.publicTotalAllInPrice - netPrice).toFixed(2)),
            hasBreakfast: h.includesBreakfastByDefault || Boolean(conv?.incluyeDesayuno),
            corporateCode: conv?.codigoConvenio ?? null,
        };
    })
        .sort((a, b) => a.netPrice - b.netPrice);
    const bestHotel = validHotels[0];
    // 3. Cruce TCO (Sincronización aterrizaje vs Check-in 15:00)
    const needsEarlyCheckInWarning = arrivalHour >= 5 && arrivalHour <= 10;
    const totalPublic = bestFlight.publicWithBags + bestHotel.publicTotalAllInPrice;
    const totalCorporate = bestFlight.netPrice + bestHotel.netPrice;
    return {
        bestFlight,
        bestHotel,
        crossPackage: {
            totalPublic: Number(totalPublic.toFixed(2)),
            totalCorporate: Number(totalCorporate.toFixed(2)),
            totalSavings: Number((totalPublic - totalCorporate).toFixed(2)),
            earlyCheckInWarning: needsEarlyCheckInWarning
                ? "El vuelo aterriza temprano en la mañana; el check-in estándar es a las 15:00 (solicitar guardaequipaje)."
                : "Horario sincronizado: aterrizan listos para hacer check-in sin pagar noches adicionales.",
        },
    };
}
