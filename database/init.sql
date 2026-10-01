CREATE TABLE IF NOT EXISTS importaciones (
    id BIGSERIAL PRIMARY KEY,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_informe VARCHAR(20) NOT NULL
        CHECK (tipo_informe IN ('OF', 'VENTAS')),
    fecha_importacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    filas_totales INTEGER NOT NULL DEFAULT 0,
    filas_validas INTEGER NOT NULL DEFAULT 0,
    filas_rechazadas INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADA', 'ERROR')),
    observacion TEXT
);

CREATE TABLE IF NOT EXISTS importacion_raw (
    id BIGSERIAL PRIMARY KEY,
    importacion_id BIGINT NOT NULL
        REFERENCES importaciones(id) ON DELETE CASCADE,
    numero_fila INTEGER NOT NULL,
    datos JSONB NOT NULL,
    errores JSONB,
    UNIQUE (importacion_id, numero_fila)
);

CREATE TABLE IF NOT EXISTS documentos (
    id BIGSERIAL PRIMARY KEY,
    importacion_id BIGINT
        REFERENCES importaciones(id) ON DELETE SET NULL,

    tipo_documento VARCHAR(20) NOT NULL,
    docentry_sap BIGINT NOT NULL,
    numero_documento BIGINT,
    folio BIGINT,
    fecha DATE NOT NULL,

    estado_sap VARCHAR(10),
    cancelada BOOLEAN NOT NULL DEFAULT FALSE,
    estado_analitico VARCHAR(30),

    tienda VARCHAR(120),
    vendedor VARCHAR(160),

    total_neto NUMERIC(18, 2),
    total_bruto NUMERIC(18, 2),
    contribucion NUMERIC(18, 2),
    margen NUMERIC(10, 2),

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tipo_documento, docentry_sap)
);

CREATE TABLE IF NOT EXISTS detalle_documento (
    id BIGSERIAL PRIMARY KEY,
    documento_id BIGINT NOT NULL
        REFERENCES documentos(id) ON DELETE CASCADE,

    linea_sap INTEGER NOT NULL,
    codigo_item VARCHAR(80),
    descripcion TEXT,

    cantidad NUMERIC(18, 4),
    cantidad_abierta NUMERIC(18, 4),

    precio_unitario NUMERIC(18, 2),
    descuento_pct NUMERIC(10, 4),
    total_linea NUMERIC(18, 2),

    tipo_linea VARCHAR(20)
        CHECK (tipo_linea IS NULL OR tipo_linea IN ('PRODUCTO', 'SERVICIO')),

    target_type INTEGER,
    target_entry BIGINT,

    UNIQUE (documento_id, linea_sap)
);

CREATE TABLE IF NOT EXISTS relaciones_documento (
    id BIGSERIAL PRIMARY KEY,

    documento_origen_id BIGINT NOT NULL
        REFERENCES documentos(id) ON DELETE CASCADE,

    linea_origen INTEGER,
    target_type INTEGER NOT NULL,
    target_docentry_sap BIGINT NOT NULL,

    documento_destino_id BIGINT
        REFERENCES documentos(id) ON DELETE SET NULL,

    tipo_venta VARCHAR(10),
    numero_documento_destino BIGINT,
    folio_destino BIGINT,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        documento_origen_id,
        linea_origen,
        target_type,
        target_docentry_sap
    )
);

CREATE INDEX IF NOT EXISTS idx_documentos_fecha
    ON documentos(fecha);

CREATE INDEX IF NOT EXISTS idx_documentos_tipo
    ON documentos(tipo_documento);

CREATE INDEX IF NOT EXISTS idx_documentos_estado_analitico
    ON documentos(estado_analitico);

CREATE INDEX IF NOT EXISTS idx_detalle_codigo_item
    ON detalle_documento(codigo_item);

CREATE INDEX IF NOT EXISTS idx_relaciones_target
    ON relaciones_documento(target_type, target_docentry_sap);
