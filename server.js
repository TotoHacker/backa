import swaggerUi from 'swagger-ui-express'
import swaggerJsDoc from 'swagger-jsdoc'

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Service Auth API',
      version: '1.0.0'
    }
  },
  apis: ['./routes/*.js'] // rutas donde documentas con JSDoc
}

const swaggerSpec = swaggerJsDoc(swaggerOptions)

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
