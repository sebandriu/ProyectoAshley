ALTER TABLE importaciones
    DROP CONSTRAINT IF EXISTS importaciones_tipo_informe_check;

ALTER TABLE importaciones
    ADD CONSTRAINT importaciones_tipo_informe_check
    CHECK (tipo_informe IN ('OF', 'VENTAS', 'CONSOLIDADO'));
