# Assestment Infligh Solutions

## 📌 Enfoque de la Solución (Flujo Conectado)
Decidí abordar ambos desafíos mediante un **flujo de trabajo conectado**, ya que en la realidad operativa de una empresa, los viajes y la legalización de gastos son dos caras de la misma moneda financiera.

* **En el Desafío 1 (Viajes):** El Bot ayuda al empleado a cotizar y armar su paquete (vuelo + hotel). Al confirmar, el sistema calcula el costo total (TCO) y *compromete* ese presupuesto.
* **En el Desafío 2 (Gastos):** Durante el viaje, el empleado reporta sus gastos (comidas, combustible, etc.) enviando fotos de recibos por chat en Telegram. El sistema audita estos gastos contra el presupuesto previamente comprometido.

## 🧠 Herramientas de IA y Proceso de Desarrollo (Enfoque Operativo)

Para resolver estos desafíos, no busqué crear un simple "chatbot de preguntas y respuestas", sino un **agente transaccional** capaz de ejecutar reglas de negocio, la IA utilizada fue Gemini y Claude Code.

**Herramientas Clave:**
* **Modelos de Extracción (Groq / Llama 3):** Los utilicé específicamente para eliminar la fricción del usuario. En lugar de obligar al empleado a llenar formularios tediosos, el modelo lee el lenguaje natural ("viajo mañana a miami con maleta") o extrae datos de la foto de un recibo arrugado.
* **Vercel AI SDK & Zod (Esquemas Estrictos):** Esta fue la pieza central para garantizar la confiabilidad. La IA puede alucinar, pero al forzarla a responder bajo un esquema estricto con zod, el sistema detecta de inmediato si falta un dato clave como una fecha de regreso y detiene el flujo para preguntarle al usuario, asegurando que Finanzas siempre reciba datos completos.

**Mi Proceso de Desarrollo:**
1. **Mapeo del Flujo de Usuario:** Primero definí qué información mínima necesita Finanzas para aprobar un gasto o un viaje, y diseñé la conversación hacia atrás desde ahí.
2. **Construcción del Motor de Reglas (TCO y Presupuesto):** Desarrollé la lógica que descarta opciones inválidas (escalas cortas, hoteles lejanos) y aplica los convenios corporativos para mostrar el ahorro real.
3. **Integración Conversacional:** Conecté el motor a Microsoft Teams mediante Adaptive Cards para que el usuario pueda tomar decisiones (Aprobar/Corregir) con simples botones sin salir de su chat de trabajo.

## 🚧 Limitaciones de la Solución y Oportunidades de Mejora

**Desafío 1 (Cotizador de Viajes):**
* **Programas de Fidelidad:** El bot actualmente contempla tarifas corporativas y convenios con la empresa, pero no integra programas de fidelidad de aerolíneas o cadenas hoteleras. Esto podría ser un área de mejora para maximizar el ahorro.
* **Precisión de precios (Edge Cases):** Aunque utilicé SerpApi para traer datos en tiempo real, en la industria de viajes los precios cambian en segundos y a veces las APIs no reflejan tasas o impuestos ocultos. El precio mostrado es una aproximación muy realista, pero el monto exacto en la pasarela de pago podría tener ligeras variaciones, esto se solucionaría con una mejor API como amadeus.

**Desafío 2 (Legalización de Gastos):**
* **Reglas de Negocio y Entorno:** La solución asume que los proyectos y los empleados ya están precargados en la base de datos. Además, maneja una sola moneda y no contempla aprobaciones jerárquicas (por ejemplo, que los topes de gasto varíen si eres analista o gerente). 
* **Seguridad y Confidencialidad (NDA):** Al procesar información financiera sensible, una versión real exigiría control de acceso por roles (RBAC), logs de auditoría estrictos y técnicas de minimización de datos para enviarle a la IA solo lo estrictamente necesario.
* **Mejoras a futuro (Next Steps):** 
  1. Construir el backend integrando extracción real mediante visión artificial (OCR + LLM) e implementar métricas para medir el porcentaje de campos correctos.
  2. Habilitar la recepción de facturas mediante correo electrónico corporativo o carpetas compartidas, no solo por chat.
  3. Cubrir los edge-cases como precios, programas de fidelidad y establecer reglas de negocios para parametrizar el agente.
