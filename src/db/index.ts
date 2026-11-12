import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

const pool = new Pool({
    connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

/**
 * Carga convenios iniciales de prueba si la tabla está vacía
 */
export async function seedInitialConvenios() {
    const existing = await db.select().from(schema.conveniosCorporativos).limit(1);
    if (existing.length > 0) return;

    await db.insert(schema.conveniosCorporativos).values([
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