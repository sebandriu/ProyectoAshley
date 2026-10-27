-- USO MANUAL Y DESTRUCTIVO: ejecutar solo antes de recargar el histórico V3.
-- Conserva tablas, configuración, usuarios y sesiones de Micapp.
-- Respaldar PostgreSQL antes de ejecutar; NO se ejecuta automáticamente.
BEGIN;

TRUNCATE TABLE
    relaciones_documento,
    detalle_documento,
    documentos,
    importacion_raw,
    importaciones
RESTART IDENTITY;

COMMIT;
