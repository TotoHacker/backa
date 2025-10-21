import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import mongoose from "mongoose";
import cors from "cors";

const app = express();

app.use(cors({
  origin: (process.env.CORS_ORIGINS?.split(",") ?? [
    "http://localhost:5173",
    "http://localhost:5174"
  ]),
  credentials: true
}));
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL || "mongodb://mongo:27017/sensors";

await mongoose.connect(MONGO_URL);

const sensorSchema = new mongoose.Schema({
  temperatura: String,
  humedad: String,
  lluvia: String,
  radiacion: String,
  timestamp: { type: Date, unique: true }
});

const SensorData = mongoose.model("SensorData", sensorSchema);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: { title: "Sensor Service API", version: "1.0.0", description: "API para datos de sensores simulados" }
  },
  apis: ["./server.js"]
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

function randomData() {
  return {
    temperatura: (20 + Math.random() * 10).toFixed(2),
    humedad: (40 + Math.random() * 30).toFixed(2),
    lluvia: Math.random() > 0.8 ? "sí" : "no",
    radiacion: (200 + Math.random() * 800).toFixed(0),
    timestamp: new Date()
  };
}

/**
 * @swagger
 * /sensor-data:
 *   get:
 *     summary: Obtener datos simulados del sensor
 *     responses:
 *       200:
 *         description: Datos de sensor generados
 */
app.get("/sensor-data", async (_req, res) => {
  const data = randomData();
  try {
    await SensorData.updateOne(
      { timestamp: data.timestamp },
      { $setOnInsert: data },
      { upsert: true }
    );
    res.json(data);
  } catch {
    res.status(500).json({ error: "Error al guardar en la base de datos" });
  }
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`Sensor Service running on ${PORT}, Swagger en /api-docs`));
