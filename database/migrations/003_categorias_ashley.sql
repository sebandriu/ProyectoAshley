-- MICAPP: ampliar catálogo analítico sin borrar los datos existentes.
-- Ejecutar una vez sobre volúmenes PostgreSQL ya inicializados.
ALTER TABLE detalle_documento
    ADD COLUMN IF NOT EXISTS codigo_ashley TEXT,
    ADD COLUMN IF NOT EXISTS categoria_general TEXT;

CREATE INDEX IF NOT EXISTS idx_detalle_codigo_ashley
    ON detalle_documento(codigo_ashley);

CREATE INDEX IF NOT EXISTS idx_detalle_categoria_general
    ON detalle_documento(categoria_general);
