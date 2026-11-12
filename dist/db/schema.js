"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.historialCotizaciones = exports.sesionesChat = exports.conveniosCorporativos = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.conveniosCorporativos = (0, pg_core_1.pgTable)("convenios_corporativos", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    tipoProveedor: (0, pg_core_1.varchar)("tipo_proveedor", { length: 20 }).notNull(), // 'AEROLINEA' | 'HOTEL'
    nombreProveedor: (0, pg_core_1.varchar)("nombre_proveedor", { length: 100 }).notNull(),
    codigoIdentificador: (0, pg_core_1.varchar)("codigo_identificador", { length: 20 }).notNull(), // Ej: 'AA', 'HILTON'
    descuentoPorcentaje: (0, pg_core_1.numeric)("descuento_porcentaje", { precision: 5, scale: 2 }).notNull(),
    maletaBodegaGratis: (0, pg_core_1.boolean)("maleta_bodega_gratis").default(false).notNull(),
    incluyeDesayuno: (0, pg_core_1.boolean)("incluye_desayuno").default(false).notNull(),
    codigoConvenio: (0, pg_core_1.varchar)("codigo_convenio", { length: 50 }).notNull(),
    activo: (0, pg_core_1.boolean)("activo").default(true).notNull(),
});
exports.sesionesChat = (0, pg_core_1.pgTable)("sesiones_chat", {
    conversationId: (0, pg_core_1.varchar)("conversation_id", { length: 255 }).primaryKey(),
    userId: (0, pg_core_1.varchar)("user_id", { length: 255 }).notNull(),
    datosExtraidos: (0, pg_core_1.jsonb)("datos_extraidos").notNull(),
    estado: (0, pg_core_1.varchar)("estado", { length: 30 }).default("ESPERANDO_DATOS").notNull(),
    actualizadoEn: (0, pg_core_1.timestamp)("actualizado_en").defaultNow().notNull(),
});
exports.historialCotizaciones = (0, pg_core_1.pgTable)("historial_cotizaciones", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    usuarioId: (0, pg_core_1.varchar)("usuario_id", { length: 255 }).notNull(),
    ruta: (0, pg_core_1.varchar)("ruta", { length: 50 }).notNull(),
    pasajeros: (0, pg_core_1.integer)("pasajeros").notNull(),
    costoPublicoTotal: (0, pg_core_1.numeric)("costo_publico_total", { precision: 10, scale: 2 }).notNull(),
    costoCorporativoTotal: (0, pg_core_1.numeric)("costo_corporativo_total", { precision: 10, scale: 2 }).notNull(),
    ahorroGenerado: (0, pg_core_1.numeric)("ahorro_generado", { precision: 10, scale: 2 }).notNull(),
    detalleOpciones: (0, pg_core_1.jsonb)("detalle_opciones").notNull(),
    creadoEn: (0, pg_core_1.timestamp)("creado_en").defaultNow().notNull(),
});
