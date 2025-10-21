import express from "express";
import { Pool } from "pg";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { randomUUID } from "crypto";
import cors from "cors";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }));

// ===== DB =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://devops:devops123@localhost:5432/parcelas_db"
});

// crea tabla
await pool.query(`
CREATE TABLE IF NOT EXISTS parcelas (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  ubicacion TEXT NOT NULL,
  eliminado BOOLEAN DEFAULT false
)`);

// ===== Swagger =====
const thisFilePath = fileURLToPath(import.meta.url);

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Parcel Service API", version: "1.0.0", description: "API para gestionar parcelas" },
    servers: [{ url: "http://localhost:4004" }],
    components: {
      schemas: {
        Parcela: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", example: "5f4d9b3b-8b1f-4c66-8a1c-0c8e6b5c1234" },
            nombre: { type: "string", example: "Parcela Norte" },
            ubicacion: { type: "string", example: "Yucatán, MX" },
            eliminado: { type: "boolean", example: false }
          },
          required: ["nombre", "ubicacion"]
        },
        CrearParcela: {
          type: "object",
          properties: {
            nombre: { type: "string", example: "Parcela Norte" },
            ubicacion: { type: "string", example: "Yucatán, MX" }
          },
          required: ["nombre", "ubicacion"]
        }
      }
    }
  },
  // Usa ruta absoluta a ESTE archivo (ESM)
  apis: [thisFilePath]
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

/**
 * @swagger
 * tags:
 *   - name: Parcelas
 *     description: Operaciones sobre parcelas
 */

/**
 * @swagger
 * /parcelas:
 *   post:
 *     summary: Crear una parcela
 *     tags: [Parcelas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CrearParcela' }
 *     responses:
 *       200:
 *         description: Parcela creada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Parcela' }
 *       500:
 *         description: Error al crear parcela
 */
app.post("/parcelas", async (req, res) => {
  const { nombre, ubicacion } = req.body;
  const id = randomUUID();
  try {
    const result = await pool.query(
      `INSERT INTO parcelas (id, nombre, ubicacion) VALUES ($1, $2, $3) RETURNING *`,
      [id, nombre, ubicacion]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /parcelas", err?.message);
    res.status(500).json({ error: "Error al crear parcela" });
  }
});

/**
 * @swagger
 * /parcelas:
 *   get:
 *     summary: Listar parcelas activas (no eliminadas)
 *     tags: [Parcelas]
 *     responses:
 *       200:
 *         description: Lista de parcelas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Parcela' }
 *       500:
 *         description: Error al listar parcelas
 */
app.get("/parcelas", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM parcelas WHERE eliminado=false ORDER BY nombre`);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /parcelas", err?.message);
    res.status(500).json({ error: "Error al listar parcelas" });
  }
});

/**
 * @swagger
 * /parcelas/{id}:
 *   delete:
 *     summary: Marcar una parcela como eliminada
 *     tags: [Parcelas]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string, format: uuid }
 *         required: true
 *         description: ID de la parcela
 *     responses:
 *       200:
 *         description: Parcela marcada como eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eliminado: { $ref: '#/components/schemas/Parcela' }
 *       404:
 *         description: No encontrada
 *       500:
 *         description: Error al eliminar parcela
 */
app.delete("/parcelas/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      `UPDATE parcelas SET eliminado=true WHERE id=$1 RETURNING *`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "no encontrada" });
    res.json({ eliminado: result.rows[0] });
  } catch (err) {
    console.error("DELETE /parcelas/:id", err?.message);
    res.status(500).json({ error: "Error al eliminar parcela" });
  }
});

/**
 * @swagger
 * /parcelas/eliminadas:
 *   get:
 *     summary: Listar parcelas eliminadas
 *     tags: [Parcelas]
 *     responses:
 *       200:
 *         description: Lista de parcelas eliminadas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Parcela' }
 *       500:
 *         description: Error al listar eliminadas
 */
app.get("/parcelas/eliminadas", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM parcelas WHERE eliminado=true ORDER BY nombre`);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /parcelas/eliminadas", err?.message);
    res.status(500).json({ error: "Error al listar eliminadas" });
  }
});

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => console.log(`Parcel Service running on ${PORT}, Swagger en /api-docs`));
