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

Genera `DATA_ENCRYPTION_KEY` (32 bytes en base64) dentro de `.env`. Sin esa clave el proceso no arranca. Si omites `PORT`, el servidor usa `3000`.

## Scripts

```bash
npm run dev        # servidor en modo watch
npm run build      # compila TypeScript a dist/
npm start          # ejecuta dist/index.js
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src
```

## Email cifrado y búsqueda

`email`, `telefono` y `curp` se guardan con AES-256-GCM. Cada cifrado lleva un IV aleatorio, así que el mismo email produce un texto distinto cada vez. Ese valor no sirve para buscar ni para un índice único.

El documento guarda también `emailHash`: un HMAC-SHA256 del email normalizado (sin espacios y en minúsculas). La clave de ese HMAC sale de `DATA_ENCRYPTION_KEY` por HKDF, separada de la clave AES. El login y la unicidad usan `emailHash`. El índice único de ese campo queda declarado en el modelo y lo creará el repositorio cuando exista la conexión. `telefono` y `curp` solo se cifran, porque no se consultan.

La contraseña no se cifra: se guarda como `passwordHash` con bcrypt y no sale en las respuestas. Tampoco se devuelven `passwordHash` ni `emailHash`.

## Health check

```bash
curl http://localhost:3000/health
```

Respuesta:

```json
{ "status": "ok" }
```
