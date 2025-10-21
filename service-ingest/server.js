import express from "express";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import cors from "cors";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }));

// Usa env var; en Docker pon mongodb://mongo:27017/sensors
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/sensors";

// ===== Conexión Mongo y arranque del server =====
async function bootstrap() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("MongoDB conectado:", MONGO_URL);

    const PORT = process.env.PORT || 4003;
    app.listen(PORT, () => console.log(`Ingest Service running on ${PORT}, Swagger en /api-docs`));
  } catch (err) {
    console.error("Error al conectar MongoDB:", err?.message);
    process.exit(1);
  }
}
bootstrap();

// ===== Schema / Modelo =====
const sensorSchema = new mongoose.Schema({
  temperatura: String,
  humedad: String,
  lluvia: String,
  radiacion: String,
  timestamp: { type: Date, default: Date.now }
});
const Sensor = mongoose.model("Sensor", sensorSchema);

// ===== Swagger =====
const thisFilePath = fileURLToPath(import.meta.url);
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Ingest Service API", version: "1.0.0", description: "API para registrar datos" },
    servers: [{ url: "http://localhost:4003" }],
    components: {
      schemas: {
        Sensor: {
          type: "object",
          properties: {
            temperatura: { type: "string", example: "25.5" },
            humedad: { type: "string", example: "55.2" },
            lluvia: { type: "string", example: "sí" },
            radiacion: { type: "string", example: "320" },
            timestamp: { type: "string", format: "date-time" }
          }
        },
        SensorCreated: {
          type: "object",
          properties: {
            status: { type: "string", example: "nuevo registro guardado" },
            id: { type: "string", example: "665f2a40e6b0a5bb9c2b4f84" }
          }
        }
      }
    }
  },
  apis: [thisFilePath]
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

// ===== Rutas =====

/**
 * @swagger
 * /ingest:
 *   post:
 *     summary: Crear un nuevo registro de sensor
 *     tags: [Sensors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Sensor' }
 *     responses:
 *       200:
 *         description: Registro creado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SensorCreated' }
 *       500: { description: Error al guardar registro }
 */
app.post("/ingest", async (req, res) => {
  try {
    const sensor = new Sensor(req.body);
    await sensor.save();
    res.json({ status: "nuevo registro guardado", id: sensor._id });
  } catch (err) {
    console.error("POST /ingest error:", err?.message);
    res.status(500).json({ error: "Error al guardar registro", detail: err?.message });
  }
});

/**
 * @swagger
 * /records:
 *   get:
 *     summary: Listar registros de sensores
 *     tags: [Sensors]
 *     responses:
 *       200:
 *         description: Lista de registros
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Sensor' } }
 *       500: { description: Error al listar registros }
 */
app.get("/records", async (_req, res) => {
  try {
    const records = await Sensor.find().sort({ timestamp: -1 });
    res.json(records);
  } catch (err) {
    console.error("GET /records error:", err?.message);
    res.status(500).json({ error: "Error al listar registros", detail: err?.message });
  }
});

// Healthcheck sencillo
app.get("/health", (_req, res) => {
  const state = mongoose.connection.readyState; // 1=connected
  res.json({ mongoState: state });
});
