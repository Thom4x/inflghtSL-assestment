"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.seedInitialConvenios = seedInitialConvenios;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const env_1 = require("../config/env");
const schema = __importStar(require("./schema"));
const pool = new pg_1.Pool({
    connectionString: env_1.env.DATABASE_URL,
});
exports.db = (0, node_postgres_1.drizzle)(pool, { schema });
/**
 * Carga convenios iniciales de prueba si la tabla está vacía
 */
async function seedInitialConvenios() {
    const existing = await exports.db.select().from(schema.conveniosCorporativos).limit(1);
    if (existing.length > 0)
        return;
    await exports.db.insert(schema.conveniosCorporativos).values([
        {
            tipoProveedor: "AEROLINEA",
            nombreProveedor: "American Airlines",
            codigoIdentificador: "AA",
            descuentoPorcentaje: "12.00",
            maletaBodegaGratis: true,
            incluyeDesayuno: false,
            codigoConvenio: "CORP-AA-2026",
            activo: true,
        },
        {
            tipoProveedor: "HOTEL",
            nombreProveedor: "Hilton Hotels & Resorts",
            codigoIdentificador: "HILTON",
            descuentoPorcentaje: "15.00",
            maletaBodegaGratis: false,
            incluyeDesayuno: true,
            codigoConvenio: "CORP-HILTON-2026",
            activo: true,
        },
    ]);
}
