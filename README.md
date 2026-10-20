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

## Logs

Cada respuesta incluye el header `x-request-id`. Si envías un UUID en ese header, se reutiliza. Si falta o no es un UUID, el servidor genera uno. El cuerpo de error no cambia.

Al terminar la petición se escribe una línea JSON. Un `4xx` queda en `warn` y un `5xx` en `error`. No se registran el body, `Authorization`, la query ni el stack.

```json
{"time":"2026-10-19T00:00:00.000Z","level":"info","message":"request completed","correlationId":"8b6c1c2e-3f4a-4d5e-9a7b-1c2d3e4f5a6b","method":"GET","path":"/health","statusCode":200,"durationMs":2}
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

## Listado

Solo `ADMIN`. `page` empieza en 1 y `limit` vale 20 si no los envías. `limit` máximo: 100. `estatus` es opcional.

```bash
curl -s 'http://localhost:3000/users?page=1&limit=20&estatus=ACTIVO' \
  -H 'Authorization: Bearer <token>'
```

Respuesta `200`:

```json
{ "users": [], "page": 1, "limit": 20, "total": 0 }
```

## Consulta por id

Un `ADMIN` puede consultar cualquier usuario. Un `USER` solo el id de su token.

```bash
curl -s http://localhost:3000/users/<id> \
  -H 'Authorization: Bearer <token>'
```

Respuesta `200`: los datos descifrados, sin `password`. Si el id no existe, responde `404`. Si un usuario pide el id de otra persona, responde `403`.

## Actualización parcial

Un `ADMIN` puede actualizar cualquier usuario. Un `USER` solo el id de su token. Los campos que no envías no cambian. `telefono` y `curp` se borran si envías `null`. Un body vacío responde `400`.

Un `USER` no puede enviar `rol`. Un `ADMIN` sí puede cambiarlo.

```bash
curl -s -X PATCH http://localhost:3000/users/<id> \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"nombre":"Ana Lopez"}'
```

Respuesta `200`: el usuario actualizado, sin `password`. Si el email pertenece a otra persona, responde `409`. Si el id no existe, responde `404`. Si un usuario pide el id de otra persona, responde `403`.

## Baja

Solo `ADMIN`. La baja es lógica: el documento no se borra y `estatus` pasa a `INACTIVO`. El login de ese usuario responde `403`. El `emailHash` sigue ocupado, así que ese email no se puede volver a registrar. Un `ADMIN` puede reactivarlo con `PATCH` y `"estatus":"ACTIVO"`.

```bash
curl -s -X DELETE http://localhost:3000/users/<id> \
  -H 'Authorization: Bearer <token>'
```

Respuesta `200`: el usuario con `estatus` `INACTIVO`, sin `password`. Si ya estaba inactivo, la respuesta es la misma y no se reescribe. Si el id no existe, responde `404`.

## Health check

```bash
curl http://localhost:3000/health
```

Respuesta:

```json
{ "status": "ok" }
```
