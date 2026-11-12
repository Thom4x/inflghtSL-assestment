"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const botbuilder_1 = require("botbuilder");
const orchestrator_1 = require("./agents/orchestrator");
const hasAzureCredentials = Boolean(process.env.MICROSOFT_APP_ID);
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Puente gratuito de identidad con Azure Bot Service (Plan F0)
const botAuth = new botbuilder_1.ConfigurationBotFrameworkAuthentication(hasAzureCredentials
    ? {
        MicrosoftAppId: process.env.MICROSOFT_APP_ID,
        MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD,
        MicrosoftAppTenantId: process.env.MICROSOFT_APP_TENANT_ID,
        MicrosoftAppType: "SingleTenant",
    }
    : {});
const adapter = new botbuilder_1.CloudAdapter(botAuth);
adapter.onTurnError = async (context, error) => {
    console.error("[Bot Error]:", error);
    await context.sendActivity("Ocurrió un error procesando tu solicitud de viaje.");
};
// 1. Endpoint oficial para Microsoft Teams
app.post("/api/messages", async (req, res) => {
    await adapter.process(req, res, async (context) => {
        if (context.activity.type === "message") {
            await context.sendActivity({ type: "typing" });
            const response = await (0, orchestrator_1.processTravelTurn)({
                conversationId: context.activity.conversation.id,
                userId: context.activity.from.aadObjectId ?? context.activity.from.id,
                userText: context.activity.text,
                cardSubmitData: context.activity.value,
            });
            await context.sendActivity({
                attachments: [botbuilder_1.CardFactory.adaptiveCard(response.card)],
            });
        }
    });
});
// 2. Endpoint local para pruebas rápidas en Insomnia / Postman sin Azure
app.post("/api/test-chat", async (req, res) => {
    try {
        const { conversationId = "test-session-1", userId = "thomas-dev", text, cardData } = req.body;
        const result = await (0, orchestrator_1.processTravelTurn)({
            conversationId,
            userId,
            userText: text,
            cardSubmitData: cardData,
        });
        res.json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error ejecutando orquestador" });
    }
});
const PORT = process.env.PORT || 3978;
app.listen(PORT, () => {
    console.log(`🚀 Travel Bot corriendo en http://localhost:${PORT}`);
});
