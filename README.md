# ProyectoAshley - Micapp

Micapp es una aplicación web de apoyo a la toma de decisiones comerciales a partir de información exportada desde SAP Business One.

## Arquitectura actual

- `client/`: React + Vite.
- `server/`: Node.js + Express.
- `database/`: esquema inicial PostgreSQL.
- `docker-compose.yml`: PostgreSQL local para desarrollo.

## Requisitos de desarrollo

- Node.js.
- Git.
- Docker Desktop.

## Levantar PostgreSQL

Desde la raíz del proyecto:

```powershell
docker compose up -d
docker compose ps
```

PostgreSQL queda disponible solamente en el equipo local por el puerto `5432`.

## Levantar el backend

La primera vez:

```powershell
Copy-Item .\server\.env.example .\server\.env
cd server
npm install
npm run dev
```

La API queda disponible en:

```text
http://localhost:3001/api
```

Para comprobar la conexión con PostgreSQL:

```text
http://localhost:3001/api/health
```

## Levantar el frontend

En otra terminal:

```powershell
cd client
npm install
npm run dev
```

## Seguridad

Los archivos `.env`, exportaciones de SAP y bases de datos locales no deben subirse al repositorio.

## Reiniciar la base de datos de desarrollo

El archivo `database/init.sql` se ejecuta automáticamente solamente cuando PostgreSQL crea el volumen por primera vez.

Para eliminar la base local y recrearla desde cero:

```powershell
docker compose down -v
docker compose up -d
```

> Este comando elimina los datos locales de PostgreSQL. Debe usarse solamente durante desarrollo.
