ALTER TABLE documentos
    ADD COLUMN IF NOT EXISTS cancelada_sap VARCHAR(1);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'documentos'
          AND column_name = 'cancelada'
    ) THEN
        EXECUTE '
            UPDATE documentos
            SET cancelada_sap =
                CASE
                    WHEN cancelada IS TRUE THEN ''Y''
                    WHEN cancelada IS FALSE THEN ''N''
                    ELSE cancelada_sap
                END
            WHERE cancelada_sap IS NULL
        ';

        EXECUTE 'ALTER TABLE documentos DROP COLUMN cancelada';
    END IF;
END $$;

ALTER TABLE documentos
    DROP CONSTRAINT IF EXISTS documentos_cancelada_sap_check;

ALTER TABLE documentos
    ADD CONSTRAINT documentos_cancelada_sap_check
    CHECK (cancelada_sap IS NULL OR cancelada_sap IN ('N', 'Y', 'C'));

ALTER TABLE detalle_documento
    ADD COLUMN IF NOT EXISTS precio_sin_iva NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS total_neto NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS total_bruto NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS costo_total NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS contribucion NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS margen NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS base_type INTEGER,
    ADD COLUMN IF NOT EXISTS base_entry BIGINT,
    ADD COLUMN IF NOT EXISTS base_line INTEGER;

CREATE INDEX IF NOT EXISTS idx_detalle_base
    ON detalle_documento(base_type, base_entry, base_line);
