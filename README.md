# ProyectoAshley · Micapp

## Regla de desarrollo

Mantener código **claro, breve y sin redundancias**. Reutilizar lo existente, implementar solo lo necesario y no sacrificar precisión ni seguridad por reducir líneas. Revisar `main` antes de cada cambio y probar lo modificado.

## Fuente única de datos comerciales

SAP Business One HANA → **Excel consolidado V3** → importación RAW/ETL → PostgreSQL → Micapp.

- `Código` / `ItemCode`: identificador SAP; `CodigoAshley`: identificador comercial; `CategoriaGeneral`: categoría del producto.
- Un único importador para OF, FR y FD. No crear un catálogo o carga paralela de categorías.
- Las líneas de servicio `700-*` se conservan en totales documentales, pero se excluyen de métricas de unidades/productos.
- Preservar las relaciones OF → FR/FD y los cálculos comerciales existentes.
- El importador comprueba que el Excel contiene las columnas del consolidado V3.

## Preparación para una carga limpia (operaciones manuales)

**No ejecutar estas operaciones hasta tener exportados los Excel V3.** El script de limpieza borra registros comerciales existentes, pero no usuarios ni tablas.

En la carpeta raíz del proyecto y con Docker iniciado:

1. **Respaldar** la base antes de vaciar los datos:
   ```powershell
   docker compose exec -T postgres pg_dump -U micapp -d micapp -Fc -f /tmp/micapp_antes_v3.dump
   docker compose cp postgres:/tmp/micapp_antes_v3.dump ..\micapp_antes_v3.dump
   ```
2. **Actualizar el esquema** (también necesario con volúmenes antiguos):
   ```powershell
   Get-Content .\database\migrations\003_categorias_ashley.sql -Raw | docker compose exec -T postgres psql -U micapp -d micapp -v ON_ERROR_STOP=1
   ```
3. **Vaciar exclusivamente datos comerciales**, una sola vez, cuando esté listo el respaldo:
   ```powershell
   Get-Content .\database\reset_comercial.sql -Raw | docker compose exec -T postgres psql -U micapp -d micapp -v ON_ERROR_STOP=1
   ```
4. Importar desde Micapp los Excel V3 (por año/intervalos si exceden **50 MB** cada uno). Verificar OF, FR, FD, categorías y KPI antes de considerar terminada la carga.

Las rutas de respaldo anteriores quedan fuera del repositorio. Si cambiaste las variables de conexión de PostgreSQL, adapta el usuario y la base de los comandos.
