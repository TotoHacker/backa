// init-mongo.js
db = db.getSiblingDB('sensors'); // crea y usa la DB

db.createCollection('sensor_data');

db.sensor_data.insertOne({
    temperatura: "25.34",
    humedad: "55.12",
    lluvia: "sí",
    radiacion: "500",
    timestamp: ISODate("2025-10-15T00:00:00Z")
});
