import {
    pgTable,
    serial,
    varchar,
    numeric,
    boolean,
    jsonb,
    timestamp,
    integer,
} from "drizzle-orm/pg-core";

export const conveniosCorporativos = pgTable("convenios_corporativos", {
    id: serial("id").primaryKey(),
    tipoProveedor: varchar("tipo_proveedor", { length: 20 }).notNull(), // 'AEROLINEA' | 'HOTEL'
    nombreProveedor: varchar("nombre_proveedor", { length: 100 }).notNull(),
    codigoIdentificador: varchar("codigo_identificador", { length: 20 }).notNull(), // Ej: 'AA', 'HILTON'
    descuentoPorcentaje: numeric("descuento_porcentaje", { precision: 5, scale: 2 }).notNull(),
    maletaBodegaGratis: boolean("maleta_bodega_gratis").default(false).notNull(),
    incluyeDesayuno: boolean("incluye_desayuno").default(false).notNull(),
    codigoConvenio: varchar("codigo_convenio", { length: 50 }).notNull(),
    activo: boolean("activo").default(true).notNull(),
});

export const sesionesChat = pgTable("sesiones_chat", {
    conversationId: varchar("conversation_id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    datosExtraidos: jsonb("datos_extraidos").notNull(),
    estado: varchar("estado", { length: 30 }).default("ESPERANDO_DATOS").notNull(),
    actualizadoEn: timestamp("actualizado_en").defaultNow().notNull(),
});

export const historialCotizaciones = pgTable("historial_cotizaciones", {
    id: serial("id").primaryKey(),
    usuarioId: varchar("usuario_id", { length: 255 }).notNull(),
    ruta: varchar("ruta", { length: 50 }).notNull(),
    pasajeros: integer("pasajeros").notNull(),
    costoPublicoTotal: numeric("costo_publico_total", { precision: 10, scale: 2 }).notNull(),
    costoCorporativoTotal: numeric("costo_corporativo_total", { precision: 10, scale: 2 }).notNull(),
    ahorroGenerado: numeric("ahorro_generado", { precision: 10, scale: 2 }).notNull(),
    detalleOpciones: jsonb("detalle_opciones").notNull(),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
});