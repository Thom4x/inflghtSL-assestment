import { z } from "zod";

const EnvSchema = z.object({
    PORT: z.string().default("3978"),
    DATABASE_URL: z.string().url("DATABASE_URL inválida"),
    GROQ_API_KEY: z.string().min(1, "Falta GROQ_API_KEY"),
    GROQ_MODEL: z.string().min(1, "Falta GROQ_MODEL"),
    SERPAPI_KEY: z.string().min(1, "Falta SERPAPI_KEY"),
    MICROSOFT_APP_ID: z.string().optional(),
    MICROSOFT_APP_PASSWORD: z.string().optional(),
    MICROSOFT_APP_TENANT_ID: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);