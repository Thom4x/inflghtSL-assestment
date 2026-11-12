CREATE TABLE "convenios_corporativos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo_proveedor" varchar(20) NOT NULL,
	"nombre_proveedor" varchar(100) NOT NULL,
	"codigo_identificador" varchar(20) NOT NULL,
	"descuento_porcentaje" numeric(5, 2) NOT NULL,
	"maleta_bodega_gratis" boolean DEFAULT false NOT NULL,
	"incluye_desayuno" boolean DEFAULT false NOT NULL,
	"codigo_convenio" varchar(50) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historial_cotizaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" varchar(255) NOT NULL,
	"ruta" varchar(50) NOT NULL,
	"pasajeros" integer NOT NULL,
	"costo_publico_total" numeric(10, 2) NOT NULL,
	"costo_corporativo_total" numeric(10, 2) NOT NULL,
	"ahorro_generado" numeric(10, 2) NOT NULL,
	"detalle_opciones" jsonb NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones_chat" (
	"conversation_id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"datos_extraidos" jsonb NOT NULL,
	"estado" varchar(30) DEFAULT 'ESPERANDO_DATOS' NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL
);
