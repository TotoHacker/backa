import express from "express"
import jwt from "jsonwebtoken"
import swaggerUi from "swagger-ui-express"
import swaggerJsDoc from "swagger-jsdoc"
import bcrypt from "bcryptjs"
import pkg from "pg"
import cors from "cors";

const { Pool } = pkg
const app = express()
app.use(express.json())
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }));

// conexión a postgres usando DATABASE_URL de docker-compose
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})



const SECRET = "secret_key_devops"

// swagger setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Auth Service API",
      version: "1.0.0",
      description: "API de autenticación"
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    }
  },
  apis: ["./server.js"]
}

const swaggerSpec = swaggerJsDoc(swaggerOptions)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Operaciones de autenticación
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Registra un nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 */
app.post("/register", async (req, res) => {
  const { username, password, role } = req.body
  const hashed = await bcrypt.hash(password, 10)
  try {
    const result = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, hashed, role]
    )
    res.json({ message: "usuario registrado", user: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "error al registrar usuario" })
  }
})

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Inicia sesión y obtiene un token JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Contraseña incorrecta
 *       404:
 *         description: Usuario no encontrado
 */
app.post("/login", async (req, res) => {
  const { username, password } = req.body
  try {
    const result = await pool.query("SELECT * FROM users WHERE username=$1", [username])
    if (result.rows.length === 0) return res.status(404).json({ error: "usuario no encontrado" })
    const user = result.rows[0]
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(401).json({ error: "contraseña incorrecta" })
    const token = jwt.sign({ username: user.username, role: user.role }, SECRET, { expiresIn: "2h" })
    res.json({ token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "error al autenticar usuario" })
  }
})

// middleware auth
function auth(role) {
  return (req, res, next) => {
    const header = req.headers.authorization
    if (!header) return res.status(401).json({ error: "token requerido" })
    try {
      const data = jwt.verify(header.split(" ")[1], SECRET)
      if (role && data.role !== role) return res.status(403).json({ error: "no autorizado" })
      req.user = data
      next()
    } catch {
      res.status(401).json({ error: "token inválido" })
    }
  }
}

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Obtiene el perfil del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Token requerido o inválido
 */
app.get("/profile", auth(), (req, res) => res.json(req.user))

app.listen(4001, () => console.log("Auth Service running on 4001, Swagger en /api-docs"))
