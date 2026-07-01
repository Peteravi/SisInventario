const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "inventario_oechsle",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "-05:00",
    dateStrings: true
});

pool.on("connection", (connection) => {
    connection.query("SET time_zone = '-05:00'");
});

module.exports = pool;