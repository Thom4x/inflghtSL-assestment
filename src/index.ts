import "dotenv/config";
import express from "express";
import {
    CardFactory,
    CloudAdapter,
    ConfigurationBotFrameworkAuthentication,
} from "botbuilder";
import { processTravelTurn } from "./agents/orchestrator";
import { seedInitialConvenios } from "./db";
const hasAzureCredentials = Boolean(process.env.MICROSOFT_APP_ID);

const app = express();
app.use(express.json());

// Puente gratuito de identidad con Azure Bot Service (Plan F0)
const botAuth = new ConfigurationBotFrameworkAuthentication(
    hasAzureCredentials
        ? {
            MicrosoftAppId: process.env.MICROSOFT_APP_ID,
            MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD,
            MicrosoftAppTenantId: process.env.MICROSOFT_APP_TENANT_ID,
            MicrosoftAppType: "SingleTenant",
        }
        : {}
);

const adapter = new CloudAdapter(botAuth);

adapter.onTurnError = async (context, error) => {
    console.error("[Bot Error]:", error);
    await context.sendActivity("Ocurrió un error procesando tu solicitud de viaje.");
};

// 1. Endpoint oficial para Microsoft Teams
app.post("/api/messages", async (req, res) => {
    await adapter.process(req, res, async (context) => {
        if (context.activity.type === "message") {
            await context.sendActivity({ type: "typing" });

            const response = await processTravelTurn({
                conversationId: context.activity.conversation.id,
                userId: context.activity.from.aadObjectId ?? context.activity.from.id,
                userText: context.activity.text,
                cardSubmitData: context.activity.value as Record<string, unknown> | undefined,
            });

            await context.sendActivity({
                attachments: [CardFactory.adaptiveCard(response.card)],
            });
        }
    });
});

// 2. Endpoint local para pruebas rápidas en Insomnia / Postman sin Azure
app.post("/api/test-chat", async (req, res) => {
    try {
        const { conversationId = "test-session-1", userId = "thomas-dev", text, cardData } = req.body;
        const result = await processTravelTurn({
            conversationId,
            userId,
            userText: text,
            cardSubmitData: cardData,
        });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error ejecutando orquestador" });
    }
});

const PORT = process.env.PORT || 3978;

async function bootstrap() {
    try {
        await seedInitialConvenios();
        console.log("✅ Convenios corporativos verificados en PostgreSQL");

        app.listen(PORT, () => {
            console.log(`🚀 Travel Bot corriendo en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Error inicializando PostgreSQL o convenios:", error);
        process.exit(1);
    }
}

bootstrap();