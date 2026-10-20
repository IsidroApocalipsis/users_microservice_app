# users_microservice_app

Microservicio HTTP con Express, TypeScript y Node.js 22.

## Requisitos

- Node.js 22
- npm

## Instalación

```bash
npm install
cp .env.example .env
```

`.env` es opcional. Si no existe, el servidor usa el puerto `3000` y `NODE_ENV=development`.

## Scripts

```bash
npm run dev        # servidor en modo watch
npm run build      # compila TypeScript a dist/
npm start          # ejecuta dist/index.js
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src
```

## Health check

```bash
curl http://localhost:3000/health
```

Respuesta:

```json
{ "status": "ok" }
```
