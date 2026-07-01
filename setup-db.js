const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function setupDatabase() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD || "123456",
            multipleStatements: true
        });

        const sqlPath = path.join(__dirname, "sql", "inventario_oechsle.sql");
        const sql = fs.readFileSync(sqlPath, "utf8");

        await connection.query(sql);

        console.log("Base de datos creada y rellenada correctamente.");
    } catch (error) {
        console.error("Error al crear la base de datos:");
        console.error(error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

setupDatabase();