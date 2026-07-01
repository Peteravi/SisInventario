process.env.TZ = "America/Lima";
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const path = require("path");
const pool = require("./db");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

function sha256(text) {
    return crypto.createHash("sha256").update(text).digest("hex");
}

const ESTADOS_PERMITIDOS = [
    "Disponible",
    "En exhibición",
    "En servicio técnico",
    "Defectuoso",
    "Dañado",
    "Empaque deteriorado",
    "En tránsito",
    "Vendido",
    "De baja"
];

const CAMBIOS_RESTRINGIDOS = [
    {
        desde: "De baja",
        hacia: "Disponible",
        perfilesPermitidos: ["Supervisor de Almacén", "Administrador de Tienda"]
    },
    {
        desde: "Vendido",
        hacia: "Disponible",
        perfilesPermitidos: ["Supervisor de Almacén", "Administrador de Tienda"]
    }
];

const PERFILES_REGISTRO_PRODUCTOS = [
    "Supervisor de Almacén",
    "Administrador de Tienda"
];

function validarErrores(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Datos inválidos.",
            errors: errors.array().map(error => ({
                campo: error.path,
                mensaje: error.msg
            }))
        });
    }

    next();
}

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function perfilPuedeRegistrarProductos(perfil) {
    const perfilNormalizado = normalizarTexto(perfil);

    return PERFILES_REGISTRO_PRODUCTOS
        .map(normalizarTexto)
        .includes(perfilNormalizado);
}

function autorizarRegistroProductos(req, res, next) {
    if (!perfilPuedeRegistrarProductos(req.usuario?.perfil)) {
        return res.status(403).json({
            success: false,
            message: "No tienes permisos para registrar productos. Solo el jefe de almacén o el administrador de tienda pueden hacerlo."
        });
    }

    next();
}

async function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Acceso no autorizado. Token no enviado."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "JWT_SECRET no está configurado en el archivo .env."
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [rows] = await pool.query(
            `SELECT 
                u.id_usuario,
                u.nombres,
                u.correo,
                p.nombre AS perfil,
                s.nombre AS sede
             FROM usuarios u
             INNER JOIN perfiles p ON u.id_perfil = p.id_perfil
             INNER JOIN sedes s ON u.id_sede = s.id_sede
             WHERE u.id_usuario = ?
             AND u.estado = 1
             LIMIT 1`,
            [decoded.id_usuario]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Usuario inactivo o no encontrado."
            });
        }

        req.usuario = rows[0];
        next();

    } catch (error) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token inválido o expirado."
            });
        }

        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error interno al validar la sesión."
        });
    }
}

app.post(
    "/api/login",
    [
        body("email")
            .trim()
            .notEmpty().withMessage("El correo es obligatorio.")
            .isEmail().withMessage("Ingrese un correo válido.")
            .normalizeEmail(),

        body("password")
            .notEmpty().withMessage("La contraseña es obligatoria.")
            .isLength({ min: 4 }).withMessage("La contraseña debe tener al menos 4 caracteres.")
    ],
    validarErrores,
    async (req, res) => {
        try {
            const { email, password } = req.body;

            const passwordHash = sha256(password);

            const [rows] = await pool.query(
                `SELECT 
                    u.id_usuario,
                    u.nombres,
                    u.correo,
                    p.nombre AS perfil,
                    s.nombre AS sede
                 FROM usuarios u
                 INNER JOIN perfiles p ON u.id_perfil = p.id_perfil
                 INNER JOIN sedes s ON u.id_sede = s.id_sede
                 WHERE u.correo = ? 
                 AND u.password_hash = ? 
                 AND u.estado = 1
                 LIMIT 1`,
                [email.toLowerCase(), passwordHash]
            );

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: "Credenciales incorrectas."
                });
            }

            const user = rows[0];

            const token = jwt.sign(
                {
                    id_usuario: user.id_usuario,
                    nombres: user.nombres,
                    correo: user.correo,
                    perfil: user.perfil,
                    sede: user.sede
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: process.env.JWT_EXPIRES_IN || "8h"
                }
            );

            return res.json({
                success: true,
                message: "Inicio de sesión correcto.",
                token,
                user
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                message: "Error interno del servidor."
            });
        }
    }
);

app.get("/api/productos", verificarToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id_producto AS id,
                codigo_producto AS codigo,
                numero_serie AS serie,
                producto AS nombre,
                marca,
                modelo,
                categoria,
                proveedor,
                estado,
                valor_referencial AS precio,
                ubicacion,
                observacion,
                fecha_registro AS fechaRegistro,
                ultima_actualizacion AS ultimaActualizacion
            FROM vista_productos_detalle
            ORDER BY id_producto DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error al obtener productos."
        });
    }
});

app.post(
    "/api/productos",
    verificarToken,
    autorizarRegistroProductos,
    [
        body("codigo")
            .trim()
            .notEmpty().withMessage("El SKU es obligatorio.")
            .matches(/^SKU-[A-Z]{3}-\d{3}$/)
            .withMessage("El SKU debe tener el formato SKU-LAP-001."),

        body("serie")
            .trim()
            .notEmpty().withMessage("El número de serie es obligatorio.")
            .matches(/^SER-[A-Z]{3}-[A-Z0-9]+-\d{4}$/)
            .withMessage("El número de serie debe tener el formato SER-LAP-HP15-2026."),

        body("nombre")
            .trim()
            .notEmpty().withMessage("El nombre del producto es obligatorio.")
            .isLength({ min: 3, max: 150 })
            .withMessage("El nombre debe tener entre 3 y 150 caracteres."),

        body("categoria")
            .trim()
            .notEmpty().withMessage("La categoría es obligatoria.")
            .isLength({ min: 3, max: 80 })
            .withMessage("La categoría debe tener entre 3 y 80 caracteres."),

        body("marca")
            .trim()
            .notEmpty().withMessage("La marca es obligatoria.")
            .isLength({ min: 2, max: 80 })
            .withMessage("La marca debe tener entre 2 y 80 caracteres."),

        body("modelo")
            .optional({ nullable: true, checkFalsy: true })
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage("El modelo debe tener entre 2 y 100 caracteres."),

        body("proveedor")
            .trim()
            .notEmpty().withMessage("El proveedor es obligatorio.")
            .isLength({ min: 3, max: 120 })
            .withMessage("El proveedor debe tener entre 3 y 120 caracteres."),

        body("estado")
            .trim()
            .notEmpty().withMessage("El estado es obligatorio.")
            .isIn(ESTADOS_PERMITIDOS)
            .withMessage("El estado seleccionado no está permitido."),

        body("precio")
            .optional({ nullable: true, checkFalsy: true })
            .isFloat({ min: 0 })
            .withMessage("El valor referencial no puede ser negativo."),

        body("ubicacion")
            .trim()
            .notEmpty().withMessage("La ubicación es obligatoria.")
            .isLength({ min: 3, max: 120 })
            .withMessage("La ubicación debe tener entre 3 y 120 caracteres."),

        body("observacion")
            .optional({ nullable: true, checkFalsy: true })
            .trim()
            .isLength({ max: 500 })
            .withMessage("La observación no debe superar 500 caracteres.")
    ],
    validarErrores,
    async (req, res) => {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const {
                codigo,
                serie,
                nombre,
                categoria,
                marca,
                modelo,
                proveedor,
                estado,
                precio,
                ubicacion,
                observacion
            } = req.body;

            const id_usuario = req.usuario.id_usuario;

            const codigoNormalizado = codigo.trim().toUpperCase();
            const serieNormalizada = serie.trim().toUpperCase();

            const [catRows] = await connection.query(
                "SELECT id_categoria FROM categorias WHERE nombre = ? LIMIT 1",
                [categoria.trim()]
            );

            const [provRows] = await connection.query(
                "SELECT id_proveedor FROM proveedores WHERE nombre = ? LIMIT 1",
                [proveedor.trim()]
            );

            const [estadoRows] = await connection.query(
                "SELECT id_estado FROM estados_producto WHERE nombre = ? LIMIT 1",
                [estado.trim()]
            );

            const [userRows] = await connection.query(
                "SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND estado = 1 LIMIT 1",
                [id_usuario]
            );

            if (catRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "La categoría no existe."
                });
            }

            if (provRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "El proveedor no existe."
                });
            }

            if (estadoRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "El estado no existe."
                });
            }

            if (userRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Usuario autenticado inválido o inactivo."
                });
            }

            const [result] = await connection.query(
                `INSERT INTO productos
                (codigo_producto, numero_serie, nombre, marca, modelo, id_categoria, id_proveedor, id_estado, valor_referencial, ubicacion, observacion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    codigoNormalizado,
                    serieNormalizada,
                    nombre.trim(),
                    marca.trim(),
                    modelo ? modelo.trim() : null,
                    catRows[0].id_categoria,
                    provRows[0].id_proveedor,
                    estadoRows[0].id_estado,
                    precio ? Number(precio) : 0,
                    ubicacion.trim(),
                    observacion ? observacion.trim() : null
                ]
            );

            await connection.query(
                `INSERT INTO historial_estados
                (id_producto, id_usuario, estado_anterior, estado_nuevo, comentario)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    result.insertId,
                    id_usuario,
                    "Registro inicial",
                    estado.trim(),
                    observacion ? observacion.trim() : "Producto registrado en el sistema."
                ]
            );

            await connection.commit();

            res.status(201).json({
                success: true,
                message: "Producto registrado correctamente."
            });

        } catch (error) {
            await connection.rollback();

            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    success: false,
                    message: "Ya existe un producto con ese SKU o número de serie."
                });
            }

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Error interno al registrar producto."
            });

        } finally {
            connection.release();
        }
    }
);

app.put(
    "/api/productos/:id/estado",
    verificarToken,
    [
        param("id")
            .isInt({ min: 1 })
            .withMessage("Producto inválido."),

        body("nuevo_estado")
            .trim()
            .notEmpty().withMessage("El nuevo estado es obligatorio.")
            .isIn(ESTADOS_PERMITIDOS)
            .withMessage("El nuevo estado no está permitido."),

        body("comentario")
            .optional({ nullable: true, checkFalsy: true })
            .trim()
            .isLength({ max: 500 })
            .withMessage("El comentario no debe superar 500 caracteres.")
    ],
    validarErrores,
    async (req, res) => {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const { id } = req.params;
            const { nuevo_estado, comentario } = req.body;

            const id_usuario = req.usuario.id_usuario;
            const nuevoEstadoLimpio = nuevo_estado.trim();

            const [productoRows] = await connection.query(
                `SELECT 
                    p.id_producto,
                    ep.nombre AS estado_actual
                 FROM productos p
                 INNER JOIN estados_producto ep ON p.id_estado = ep.id_estado
                 WHERE p.id_producto = ?
                 LIMIT 1`,
                [id]
            );

            if (productoRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Producto no encontrado."
                });
            }

            const estadoAnterior = productoRows[0].estado_actual;

            if (estadoAnterior === nuevoEstadoLimpio) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "El nuevo estado debe ser diferente al estado actual."
                });
            }

            const [userRows] = await connection.query(
                `SELECT 
                    u.id_usuario,
                    u.nombres,
                    p.nombre AS perfil
                 FROM usuarios u
                 INNER JOIN perfiles p ON u.id_perfil = p.id_perfil
                 WHERE u.id_usuario = ?
                 AND u.estado = 1
                 LIMIT 1`,
                [id_usuario]
            );

            if (userRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Usuario autenticado inválido o inactivo."
                });
            }

            const perfilUsuario = userRows[0].perfil;

            const cambioRestringido = CAMBIOS_RESTRINGIDOS.find(cambio =>
                cambio.desde === estadoAnterior && cambio.hacia === nuevoEstadoLimpio
            );

            if (
                cambioRestringido &&
                !cambioRestringido.perfilesPermitidos.includes(perfilUsuario)
            ) {
                await connection.rollback();
                return res.status(403).json({
                    success: false,
                    message: `No tienes autorización para cambiar un producto de "${estadoAnterior}" a "${nuevoEstadoLimpio}".`
                });
            }

            const [estadoRows] = await connection.query(
                "SELECT id_estado FROM estados_producto WHERE nombre = ? LIMIT 1",
                [nuevoEstadoLimpio]
            );

            if (estadoRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Estado no válido."
                });
            }

            await connection.query(
                "UPDATE productos SET id_estado = ? WHERE id_producto = ?",
                [estadoRows[0].id_estado, id]
            );

            await connection.query(
                `INSERT INTO historial_estados
                (id_producto, id_usuario, estado_anterior, estado_nuevo, comentario)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    id,
                    id_usuario,
                    estadoAnterior,
                    nuevoEstadoLimpio,
                    comentario ? comentario.trim() : "Cambio de estado sin comentario adicional."
                ]
            );

            await connection.commit();

            res.json({
                success: true,
                message: "Estado actualizado correctamente."
            });

        } catch (error) {
            await connection.rollback();
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Error interno al actualizar estado."
            });

        } finally {
            connection.release();
        }
    }
);

app.get("/api/historial", verificarToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                h.id_historial AS id,
                h.id_producto AS productId,
                p.codigo_producto AS codigo,
                p.nombre AS producto,
                h.estado_anterior AS estadoAnterior,
                h.estado_nuevo AS estadoNuevo,
                u.nombres AS usuario,
                h.comentario,
                h.fecha_cambio AS fecha
            FROM historial_estados h
            INNER JOIN productos p ON h.id_producto = p.id_producto
            INNER JOIN usuarios u ON h.id_usuario = u.id_usuario
            ORDER BY h.fecha_cambio DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error al obtener historial."
        });
    }
});

app.get("/api/reportes/estado", verificarToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                estado,
                cantidad_productos AS cantidad,
                valor_total
            FROM vista_reporte_por_estado
            ORDER BY cantidad_productos DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error al obtener reporte por estado."
        });
    }
});

app.get("/api/reportes/categoria", verificarToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                categoria,
                cantidad_productos AS cantidad,
                valor_total
            FROM vista_reporte_por_categoria
            ORDER BY cantidad_productos DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error al obtener reporte por categoría."
        });
    }
});

app.get("/api/reportes/movimientos", verificarToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id_movimiento,
                sku,
                numero_serie,
                producto,
                motivo,
                tipo_movimiento,
                estado_producto,
                cantidad,
                usuario_responsable,
                documento_referencia,
                observaciones,
                fecha_movimiento
            FROM vista_movimientos_detalle
            ORDER BY fecha_movimiento DESC
            LIMIT 20
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error al obtener movimientos de inventario."
        });
    }
});

app.get("/api/reportes/indicadores", verificarToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id_indicador,
                tipo_medicion,
                periodo,
                errores_registro,
                incidencias_mensuales,
                productos_revisados,
                productos_correctos,
                porcentaje_precision,
                tiempo_validacion_promedio,
                tiempo_registro_promedio,
                observacion,
                fecha_registro
            FROM vista_indicadores_comparativo
            ORDER BY id_indicador ASC
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error al obtener indicadores comparativos."
        });
    }
});

app.get("/api/reportes/mejora", verificarToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                periodo_preprueba,
                periodo_posprueba,
                errores_preprueba,
                errores_posprueba,
                mejora_errores_porcentaje,
                incidencias_preprueba,
                incidencias_posprueba,
                mejora_incidencias_porcentaje,
                tiempo_validacion_preprueba,
                tiempo_validacion_posprueba,
                mejora_tiempo_validacion_porcentaje,
                tiempo_registro_preprueba,
                tiempo_registro_posprueba,
                mejora_tiempo_registro_porcentaje,
                precision_preprueba,
                precision_posprueba,
                mejora_precision_puntos
            FROM vista_mejora_indicadores
            LIMIT 1
        `);

        res.json(rows[0] || null);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error al obtener mejora de indicadores."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});