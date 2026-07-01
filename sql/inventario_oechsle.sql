DROP DATABASE IF EXISTS inventario_oechsle;

CREATE DATABASE inventario_oechsle
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE inventario_oechsle;

CREATE TABLE sedes (
    id_sede INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE,
    direccion VARCHAR(180),
    ciudad VARCHAR(80),
    estado TINYINT NOT NULL DEFAULT 1,
    CHECK (estado IN (0,1))
);

CREATE TABLE perfiles (
    id_perfil INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    descripcion VARCHAR(200)
);

CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_perfil INT NOT NULL,
    id_sede INT NOT NULL,
    nombres VARCHAR(120) NOT NULL,
    correo VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    estado TINYINT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_perfil) REFERENCES perfiles(id_perfil),
    FOREIGN KEY (id_sede) REFERENCES sedes(id_sede),
    CHECK (estado IN (0,1))
);

CREATE TABLE categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    descripcion VARCHAR(200)
);

CREATE TABLE proveedores (
    id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE,
    ruc VARCHAR(20),
    telefono VARCHAR(20),
    correo VARCHAR(120),
    direccion VARCHAR(180),
    pais VARCHAR(60) DEFAULT 'Perú',
    estado TINYINT NOT NULL DEFAULT 1,
    CHECK (estado IN (0,1))
);

CREATE TABLE estados_producto (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    descripcion VARCHAR(250)
);

CREATE TABLE motivos_movimiento (
    id_motivo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    tipo ENUM('Entrada', 'Salida', 'Salida lógica', 'Entrada lógica') NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    estado_sugerido VARCHAR(80),
    estado TINYINT NOT NULL DEFAULT 1,
    CHECK (estado IN (0,1))
);

CREATE TABLE productos (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    codigo_producto VARCHAR(50) NOT NULL UNIQUE,
    numero_serie VARCHAR(100) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    marca VARCHAR(80) NOT NULL,
    modelo VARCHAR(100),
    id_categoria INT NOT NULL,
    id_proveedor INT NOT NULL,
    id_estado INT NOT NULL,
    valor_referencial DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ubicacion VARCHAR(120) NOT NULL,
    observacion TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria),
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
    FOREIGN KEY (id_estado) REFERENCES estados_producto(id_estado),
    CHECK (codigo_producto REGEXP '^SKU-[A-Z]{3}-[0-9]{3}$'),
    CHECK (numero_serie REGEXP '^SER-[A-Z]{2,4}-[A-Z0-9]{2,10}-[0-9]{4}$'),
    CHECK (CHAR_LENGTH(nombre) BETWEEN 3 AND 150),
    CHECK (CHAR_LENGTH(marca) BETWEEN 2 AND 80),
    CHECK (modelo IS NULL OR CHAR_LENGTH(modelo) BETWEEN 2 AND 100),
    CHECK (valor_referencial >= 0),
    CHECK (CHAR_LENGTH(ubicacion) BETWEEN 3 AND 120)
);

CREATE TABLE historial_estados (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL,
    id_usuario INT NOT NULL,
    estado_anterior VARCHAR(80) NOT NULL,
    estado_nuevo VARCHAR(80) NOT NULL,
    comentario TEXT,
    fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE movimientos_inventario (
    id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL,
    id_usuario INT NOT NULL,
    id_motivo INT NOT NULL,
    tipo_movimiento ENUM('Entrada', 'Salida', 'Salida lógica', 'Entrada lógica') NOT NULL,
    estado_producto VARCHAR(80) NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    numero_serie VARCHAR(100),
    documento_referencia VARCHAR(180),
    observaciones TEXT,
    fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_motivo) REFERENCES motivos_movimiento(id_motivo),
    CHECK (cantidad >= 1)
);

CREATE TABLE indicadores_inventario (
    id_indicador INT AUTO_INCREMENT PRIMARY KEY,
    tipo_medicion ENUM('PREPRUEBA', 'POSPRUEBA') NOT NULL,
    periodo VARCHAR(20) NOT NULL,
    errores_registro INT NOT NULL DEFAULT 0,
    incidencias_mensuales INT NOT NULL DEFAULT 0,
    productos_revisados INT NOT NULL DEFAULT 0,
    productos_correctos INT NOT NULL DEFAULT 0,
    tiempo_validacion_promedio DECIMAL(10,2) NOT NULL DEFAULT 0,
    tiempo_registro_promedio DECIMAL(10,2) NOT NULL DEFAULT 0,
    observacion TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (periodo REGEXP '^[0-9]{4}-[0-9]{2}$'),
    CHECK (errores_registro >= 0),
    CHECK (incidencias_mensuales >= 0),
    CHECK (productos_revisados > 0),
    CHECK (productos_correctos >= 0),
    CHECK (productos_correctos <= productos_revisados),
    CHECK (tiempo_validacion_promedio >= 0),
    CHECK (tiempo_registro_promedio >= 0)
);

INSERT INTO sedes (nombre, direccion, ciudad) VALUES
('OECHSLE SEDE PURUCHUCO', 'Centro Comercial Real Plaza Puruchuco', 'Lima');

INSERT INTO perfiles (nombre, descripcion) VALUES
('Supervisor de Almacén', 'Responsable del control general del inventario'),
('Operador de Almacén', 'Registra y actualiza productos del inventario'),
('Administrador de Tienda', 'Supervisa la operación comercial y disponibilidad'),
('Asesor de Postventa', 'Gestiona productos derivados a postventa o servicio técnico');

INSERT INTO usuarios (id_perfil, id_sede, nombres, correo, password_hash) VALUES
(1, 1, 'Jefe de Almacén', 'jefe@oechsle.com', SHA2('123456', 256)),
(2, 1, 'Auxiliar de Almacén', 'operador@oechsle.com', SHA2('123456', 256)),
(3, 1, 'Administrador de Tienda', 'admin.tienda@oechsle.com', SHA2('123456', 256)),
(4, 1, 'Asesor de Postventa', 'postventa@oechsle.com', SHA2('123456', 256));

INSERT INTO categorias (nombre, descripcion) VALUES
('Laptops', 'Equipos portátiles de alto valor'),
('Celulares', 'Smartphones de gama media y alta'),
('Impresoras', 'Impresoras multifuncionales y láser'),
('Monitores', 'Pantallas y monitores de alto valor'),
('Televisores', 'Smart TV y televisores de gran formato');

INSERT INTO proveedores 
(nombre, ruc, telefono, correo, direccion, pais) VALUES
('Deltron Perú', '20500000001', '999111222', 'ventas@deltronperu.com', 'Lima, Perú', 'Perú'),
('Intcomex Perú', '20500000002', '999222333', 'ventas@intcomexperu.com', 'Lima, Perú', 'Perú'),
('Ingram Micro Perú', '20500000003', '999333444', 'ventas@ingrammicroperu.com', 'Lima, Perú', 'Perú'),
('Memory Kings Perú', '20500000004', '999444555', 'ventas@memorykingsperu.com', 'Lima, Perú', 'Perú'),
('Impacto Perú', '20500000005', '999555666', 'ventas@impactoperu.com', 'Lima, Perú', 'Perú'),
('Distribuidora Tecnológica Lima', '20500000006', '999666777', 'ventas@disttecnologicalima.com', 'Lima, Perú', 'Perú');

INSERT INTO estados_producto (nombre, descripcion) VALUES
('Disponible', 'Producto apto para la venta y almacenado.'),
('En exhibición', 'Producto utilizado para demostración en tienda.'),
('En servicio técnico', 'Producto enviado a reparación o diagnóstico.'),
('Defectuoso', 'Producto con fallas de funcionamiento.'),
('Dañado', 'Producto con daños físicos.'),
('Empaque deteriorado', 'Producto funcional con empaque dañado.'),
('En tránsito', 'Producto trasladándose entre tiendas o almacenes.'),
('Vendido', 'Producto entregado al cliente.'),
('De baja', 'Producto retirado definitivamente del inventario.');

INSERT INTO motivos_movimiento 
(nombre, tipo, descripcion, estado_sugerido) VALUES
('Compra', 'Entrada', 'Ingreso de productos recibidos desde un proveedor.', 'Disponible'),
('Venta', 'Salida', 'Salida del producto por venta al cliente.', 'Vendido'),
('Devolución de cliente', 'Entrada', 'Ingreso de producto devuelto por el cliente.', 'Disponible'),
('Cambio por garantía - Ingreso', 'Entrada', 'Ingreso del producto defectuoso entregado por garantía.', 'Defectuoso'),
('Cambio por garantía - Salida', 'Salida', 'Salida de producto nuevo entregado como reemplazo.', 'Vendido'),
('Envío a servicio técnico', 'Salida', 'Salida del producto hacia servicio técnico autorizado.', 'En servicio técnico'),
('Retorno de servicio técnico', 'Entrada', 'Ingreso del producto luego de revisión técnica.', 'Disponible'),
('Transferencia a otra tienda', 'Salida', 'Salida de productos enviados a otra sucursal.', 'En tránsito'),
('Transferencia desde otra tienda', 'Entrada', 'Ingreso de productos recibidos desde otra sucursal.', 'Disponible'),
('Ajuste positivo', 'Entrada', 'Ingreso por producto encontrado durante inventario físico.', 'Disponible'),
('Ajuste negativo', 'Salida', 'Salida por faltante detectado durante inventario físico.', 'De baja'),
('Baja de inventario', 'Salida', 'Retiro definitivo del producto.', 'De baja'),
('Exhibición', 'Salida lógica', 'Cambio lógico hacia área de exhibición.', 'En exhibición'),
('Retorno de exhibición', 'Entrada lógica', 'Retorno lógico desde exhibición hacia almacén.', 'Disponible');

INSERT INTO productos 
(codigo_producto, numero_serie, nombre, marca, modelo, id_categoria, id_proveedor, id_estado, valor_referencial, ubicacion, observacion)
VALUES
('SKU-LAP-001', 'SER-LAP-HP-0001', 'Laptop HP Pavilion 15', 'HP', 'Pavilion 15', 1, 1, 1, 2899.90, 'Almacén principal', 'Producto nuevo apto para venta'),
('SKU-LAP-002', 'SER-LAP-LEN-0002', 'Laptop Lenovo IdeaPad 5', 'Lenovo', 'IdeaPad 5', 1, 2, 2, 3199.90, 'Zona de exhibición', 'Producto destinado a exhibición'),
('SKU-LAP-003', 'SER-LAP-ASU-0003', 'Laptop Asus Vivobook 16', 'Asus', 'Vivobook 16', 1, 3, 3, 3499.90, 'Servicio técnico', 'Pendiente de revisión técnica'),

('SKU-CEL-001', 'SER-CEL-SAM-0001', 'Samsung Galaxy S24', 'Samsung', 'Galaxy S24', 2, 2, 1, 3799.90, 'Vitrina celulares', 'Producto disponible'),
('SKU-CEL-002', 'SER-CEL-XIA-0002', 'Xiaomi Redmi Note 13 Pro', 'Xiaomi', 'Redmi Note 13 Pro', 2, 4, 6, 1499.90, 'Almacén principal', 'Empaque deteriorado'),
('SKU-CEL-003', 'SER-CEL-MOT-0003', 'Motorola Edge 40', 'Motorola', 'Edge 40', 2, 5, 5, 1899.90, 'Área de incidencias', 'Producto con daño reportado'),

('SKU-IMP-001', 'SER-IMP-HP-0001', 'Impresora HP Smart Tank', 'HP', 'Smart Tank 580', 3, 1, 1, 899.90, 'Almacén principal', 'Producto disponible'),
('SKU-IMP-002', 'SER-IMP-EPS-0002', 'Impresora Epson EcoTank', 'Epson', 'L3250', 3, 6, 2, 799.90, 'Zona de exhibición', 'Producto en exhibición'),
('SKU-IMP-003', 'SER-IMP-BRO-0003', 'Impresora Brother Laser', 'Brother', 'DCP-L2540DW', 3, 3, 3, 1199.90, 'Servicio técnico', 'Revisión por falla de impresión'),

('SKU-MON-001', 'SER-MON-LG-0001', 'Monitor LG UltraWide', 'LG', '29WP500', 4, 5, 1, 1299.90, 'Almacén principal', 'Producto disponible'),
('SKU-MON-002', 'SER-MON-SAM-0002', 'Monitor Samsung Odyssey', 'Samsung', 'Odyssey G5', 4, 2, 2, 1599.90, 'Zona de exhibición', 'Producto en exhibición'),
('SKU-MON-003', 'SER-MON-LEN-0003', 'Monitor Lenovo ThinkVision', 'Lenovo', 'ThinkVision E24', 4, 4, 6, 999.90, 'Almacén principal', 'Caja deteriorada'),

('SKU-TEL-001', 'SER-TV-SAM-0001', 'Smart TV Samsung 55"', 'Samsung', 'Crystal UHD 55', 5, 2, 1, 2599.90, 'Almacén principal', 'Producto disponible'),
('SKU-TEL-002', 'SER-TV-LG-0002', 'Smart TV LG 65"', 'LG', 'UQ7500 65', 5, 5, 2, 3499.90, 'Zona de exhibición', 'Producto en exhibición'),
('SKU-TEL-003', 'SER-TV-SON-0003', 'Smart TV Sony Bravia 55"', 'Sony', 'Bravia X80L', 5, 3, 5, 3999.90, 'Área de incidencias', 'Pantalla con daño reportado');

INSERT INTO historial_estados 
(id_producto, id_usuario, estado_anterior, estado_nuevo, comentario)
SELECT 
    p.id_producto,
    1,
    'Registro inicial',
    ep.nombre,
    'Producto registrado inicialmente en el sistema'
FROM productos p
INNER JOIN estados_producto ep ON p.id_estado = ep.id_estado;

INSERT INTO movimientos_inventario 
(id_producto, id_usuario, id_motivo, tipo_movimiento, estado_producto, cantidad, numero_serie, documento_referencia, observaciones)
SELECT
    p.id_producto,
    1,
    1,
    'Entrada',
    ep.nombre,
    1,
    p.numero_serie,
    'INV-INICIAL-2026',
    'Ingreso inicial del producto al inventario'
FROM productos p
INNER JOIN estados_producto ep ON p.id_estado = ep.id_estado;

INSERT INTO indicadores_inventario
(tipo_medicion, periodo, errores_registro, incidencias_mensuales, productos_revisados, productos_correctos, tiempo_validacion_promedio, tiempo_registro_promedio, observacion)
VALUES
('PREPRUEBA', '2026-01', 18, 9, 50, 35, 6.50, 4.20, 'Medición previa a la implementación del sistema web.'),
('POSPRUEBA', '2026-02', 5, 2, 50, 47, 1.80, 1.30, 'Medición posterior a la implementación del sistema web.');

CREATE VIEW vista_productos_detalle AS
SELECT 
    p.id_producto,
    p.codigo_producto,
    p.numero_serie,
    p.nombre AS producto,
    p.marca,
    p.modelo,
    c.nombre AS categoria,
    pr.nombre AS proveedor,
    ep.nombre AS estado,
    p.valor_referencial,
    p.ubicacion,
    p.observacion,
    p.fecha_registro,
    p.ultima_actualizacion
FROM productos p
INNER JOIN categorias c ON p.id_categoria = c.id_categoria
INNER JOIN proveedores pr ON p.id_proveedor = pr.id_proveedor
INNER JOIN estados_producto ep ON p.id_estado = ep.id_estado;

CREATE VIEW vista_reporte_por_estado AS
SELECT 
    ep.nombre AS estado,
    COUNT(p.id_producto) AS cantidad_productos,
    COALESCE(SUM(p.valor_referencial), 0) AS valor_total
FROM estados_producto ep
LEFT JOIN productos p ON ep.id_estado = p.id_estado
GROUP BY ep.id_estado, ep.nombre;

CREATE VIEW vista_reporte_por_categoria AS
SELECT 
    c.nombre AS categoria,
    COUNT(p.id_producto) AS cantidad_productos,
    COALESCE(SUM(p.valor_referencial), 0) AS valor_total
FROM categorias c
LEFT JOIN productos p ON c.id_categoria = p.id_categoria
GROUP BY c.id_categoria, c.nombre;

CREATE VIEW vista_movimientos_detalle AS
SELECT
    m.id_movimiento,
    p.codigo_producto AS sku,
    p.numero_serie,
    p.nombre AS producto,
    mm.nombre AS motivo,
    m.tipo_movimiento,
    m.estado_producto,
    m.cantidad,
    u.nombres AS usuario_responsable,
    m.documento_referencia,
    m.observaciones,
    m.fecha_movimiento
FROM movimientos_inventario m
INNER JOIN productos p ON m.id_producto = p.id_producto
INNER JOIN usuarios u ON m.id_usuario = u.id_usuario
INNER JOIN motivos_movimiento mm ON m.id_motivo = mm.id_motivo;

CREATE VIEW vista_indicadores_comparativo AS
SELECT
    id_indicador,
    tipo_medicion,
    periodo,
    errores_registro,
    incidencias_mensuales,
    productos_revisados,
    productos_correctos,
    ROUND((productos_correctos / productos_revisados) * 100, 2) AS porcentaje_precision,
    tiempo_validacion_promedio,
    tiempo_registro_promedio,
    observacion,
    fecha_registro
FROM indicadores_inventario;

CREATE VIEW vista_mejora_indicadores AS
SELECT
    pre.periodo AS periodo_preprueba,
    pos.periodo AS periodo_posprueba,

    pre.errores_registro AS errores_preprueba,
    pos.errores_registro AS errores_posprueba,
    ROUND(((pre.errores_registro - pos.errores_registro) / NULLIF(pre.errores_registro, 0)) * 100, 2) AS mejora_errores_porcentaje,

    pre.incidencias_mensuales AS incidencias_preprueba,
    pos.incidencias_mensuales AS incidencias_posprueba,
    ROUND(((pre.incidencias_mensuales - pos.incidencias_mensuales) / NULLIF(pre.incidencias_mensuales, 0)) * 100, 2) AS mejora_incidencias_porcentaje,

    pre.tiempo_validacion_promedio AS tiempo_validacion_preprueba,
    pos.tiempo_validacion_promedio AS tiempo_validacion_posprueba,
    ROUND(((pre.tiempo_validacion_promedio - pos.tiempo_validacion_promedio) / NULLIF(pre.tiempo_validacion_promedio, 0)) * 100, 2) AS mejora_tiempo_validacion_porcentaje,

    pre.tiempo_registro_promedio AS tiempo_registro_preprueba,
    pos.tiempo_registro_promedio AS tiempo_registro_posprueba,
    ROUND(((pre.tiempo_registro_promedio - pos.tiempo_registro_promedio) / NULLIF(pre.tiempo_registro_promedio, 0)) * 100, 2) AS mejora_tiempo_registro_porcentaje,

    ROUND((pre.productos_correctos / pre.productos_revisados) * 100, 2) AS precision_preprueba,
    ROUND((pos.productos_correctos / pos.productos_revisados) * 100, 2) AS precision_posprueba,
    ROUND(
        ((pos.productos_correctos / pos.productos_revisados) * 100) -
        ((pre.productos_correctos / pre.productos_revisados) * 100),
        2
    ) AS mejora_precision_puntos
FROM indicadores_inventario pre
INNER JOIN indicadores_inventario pos
WHERE pre.tipo_medicion = 'PREPRUEBA'
AND pos.tipo_medicion = 'POSPRUEBA'
LIMIT 1;

SELECT * FROM vista_productos_detalle;
SELECT * FROM vista_reporte_por_estado;
SELECT * FROM vista_reporte_por_categoria;
SELECT * FROM vista_movimientos_detalle;
SELECT * FROM vista_indicadores_comparativo;
SELECT * FROM vista_mejora_indicadores;