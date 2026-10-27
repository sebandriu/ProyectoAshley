# ProyectoAshley · Micapp

## Regla permanente de desarrollo

Priorizar **código claro, breve, reutilizable y mantenible**, sin sacrificar la corrección de los datos.

- Implementar solo lo necesario para requisitos reales. Evitar abstracciones prematuras, duplicación, dependencias y archivos sin utilidad.
- Reutilizar los servicios, consultas, componentes y flujos existentes antes de incorporar alternativas nuevas.
- Mantener una sola fuente de verdad para cada dato; no duplicar procesos de carga o cálculos de KPI.
- Antes de cambiar código, revisar `main`, los archivos afectados y el impacto en los flujos actuales.
- Conservar funcionalidad y datos históricos. Verificar cambios con pruebas proporcionales al alcance y eliminar código obsoleto cuando sea seguro.

## Decisión de importación de productos

- **Un solo flujo comercial:** SAP Business One HANA → consulta consolidada V3 → XLSX → importación RAW/ETL existente → PostgreSQL → Micapp.
- `Código`/`ItemCode` identifica el artículo en SAP. `CodigoAshley` es su código comercial y `CategoriaGeneral` su clasificación (no son dos categorías).
- Guardar esos campos con las líneas de documentos que ya importa el ETL. **No crear un catálogo maestro ni un segundo importador** mientras no exista una necesidad funcional justificada.
- Para completar los campos de datos antiguos, volver a importar el histórico con la V3, por rangos de fecha si fuese necesario; no borrar la base de datos para hacerlo.
- Las líneas de servicio `700-*` se conservan para cuadratura monetaria, pero no se cuentan como productos en métricas de demanda o unidades.
- Conservar las relaciones OF → FR/FD y las reglas de deduplicación de documentos.

Esta es la referencia de diseño para cambios futuros; se puede revisar si aparecen requisitos nuevos que la justifiquen.
