"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const EnvSchema = zod_1.z.object({
    PORT: zod_1.z.string().default("3978"),
    DATABASE_URL: zod_1.z.string().url("DATABASE_URL inválida"),
    GROQ_API_KEY: zod_1.z.string().min(1, "Falta GROQ_API_KEY"),
    MICROSOFT_APP_ID: zod_1.z.string().optional(),
    MICROSOFT_APP_PASSWORD: zod_1.z.string().optional(),
    MICROSOFT_APP_TENANT_ID: zod_1.z.string().optional(),
});
exports.env = EnvSchema.parse(process.env);
