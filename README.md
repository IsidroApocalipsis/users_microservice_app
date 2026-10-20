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

Completa en `.env` `DATA_ENCRYPTION_KEY`, `MONGODB_URI` y `JWT_SECRET`. Sin esas variables el proceso no arranca. `JWT_EXPIRES_IN` vale `1h` si no la defines. Si omites `PORT`, el servidor usa `3000`.

## Scripts

```bash
npm run dev        # servidor en modo watch
npm run build      # compila TypeScript a dist/
npm start          # ejecuta dist/index.js
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src
npm test           # pruebas de cifrado y login
npm run seed       # crea el primer ADMIN si el email no existe
```

## Email cifrado y búsqueda

`email`, `telefono` y `curp` se guardan con AES-256-GCM. Cada cifrado lleva un IV aleatorio, así que el mismo email produce un texto distinto cada vez. Ese valor no sirve para buscar ni para un índice único.

El documento guarda también `emailHash`: un HMAC-SHA256 del email normalizado (sin espacios y en minúsculas). La clave de ese HMAC sale de `DATA_ENCRYPTION_KEY` por HKDF, separada de la clave AES. El login y la unicidad usan `emailHash`. Al conectar, la aplicación crea el índice único `users_emailHash_unique` sobre ese campo. `telefono` y `curp` solo se cifran, porque no se consultan.

La contraseña no se cifra: se guarda como `passwordHash` con bcrypt y no sale en las respuestas. Tampoco se devuelven `passwordHash` ni `emailHash`.

## Primer administrador

Define `SEED_ADMIN_NOMBRE`, `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` en `.env`. Esas variables no hacen falta para arrancar el servidor.

```bash
npm run seed
```

El script cifra el email, guarda la contraseña con bcrypt y crea un usuario `ADMIN` activo. Si ese email ya existe, no inserta otro ni cambia su rol. La salida solo muestra el email.

## Login

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"secret123"}'
```

Respuesta:

```json
{ "accessToken": "<jwt>" }
```

El token incluye `sub` y `rol`, y vence según `JWT_EXPIRES_IN`.

## Alta de usuario

Requiere un token de `ADMIN` en `Authorization: Bearer <token>`.

```bash
curl -s -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"nombre":"Ana Perez","email":"ana@example.com","password":"secret123"}'
```

Respuesta `201`: el usuario creado, sin `password`. Si no envías `rol`, queda `USER`. Si el email ya existe, responde `409`.

## Consulta por id

Un `ADMIN` puede consultar cualquier usuario. Un `USER` solo el id de su token.

```bash
curl -s http://localhost:3000/users/<id> \
  -H 'Authorization: Bearer <token>'
```

Respuesta `200`: los datos descifrados, sin `password`. Si el id no existe, responde `404`. Si un usuario pide el id de otra persona, responde `403`.

## Health check

```bash
curl http://localhost:3000/health
```

Respuesta:

```json
{ "status": "ok" }
```
