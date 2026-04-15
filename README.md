# CronosFlow - Stage Timer / Conference Timer

Aplicación full-stack para controlar tiempos de discursantes en vivo, con panel admin remoto y pantalla de escenario sincronizada en tiempo real.

## Stack

- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Realtime: Socket.io (WebSockets + fallback)

## Estructura

- `client/` → aplicación React (`/admin` y `/display`)
- `server/` → API + Socket.io

## Funcionalidades

- Panel admin (`/admin`): crear/editar/eliminar discursantes, iniciar, pausar, siguiente y reset.
- Pantalla display (`/display`): nombre grande, cuenta regresiva grande, colores por estado de tiempo.
- Soporte multi-sala con query param: `?room=estaca1`.
- Sincronización instantánea entre múltiples dispositivos.
- Reconexion automática de sockets.

---

## Ejecutar localmente

### 1) Instalar dependencias

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 2) Configurar variables de entorno

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### 3) Levantar frontend + backend

```bash
npm run dev
```

- Frontend: http://localhost:5173/admin?room=estaca1
- Display: http://localhost:5173/display?room=estaca1
- Backend: http://localhost:4000/health

---

## Deploy GRATIS paso a paso

> Opción recomendada: **Frontend en Vercel + Backend en Render (free tier)**.

### A. Subir repo a GitHub

1. Crear repositorio en GitHub (por ejemplo `cronosflow`).
2. En local:

```bash
git init
git add .
git commit -m "Initial CronosFlow"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/cronosflow.git
git push -u origin main
```

### B. Deploy del backend en Render (gratis)

1. Entrar a https://render.com y loguearte con GitHub.
2. `New +` → `Web Service`.
3. Elegir el repo y configurar:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Variables de entorno:
   - `CLIENT_URL` = URL pública de Vercel (ej: `https://cronosflow.vercel.app`)
5. Crear servicio. Esperar deploy.
6. Guardar URL backend (ej: `https://cronosflow-server.onrender.com`).

> También podés usar `render.yaml` incluido en este repo para desplegar con infraestructura declarativa.

### C. Deploy del frontend en Vercel (gratis)

1. Entrar a https://vercel.com e importar el repo.
2. En configuración del proyecto:
   - **Root Directory**: `client`
   - Framework detectado: Vite
3. Variables de entorno:
   - `VITE_SOCKET_URL` = URL pública del backend en Render (`https://...onrender.com`)
4. Deploy.

El archivo `client/vercel.json` ya incluye fallback SPA para rutas `/admin` y `/display`.

### D. Habilitar WebSockets en producción

- En este proyecto, Socket.io usa `transports: ['websocket', 'polling']`, por lo que funciona con fallback.
- Render soporta WebSockets en Web Services Node.js.
- Asegurate de que `CLIENT_URL` en backend coincida exactamente con el dominio del frontend (sin slash final).

### E. Probar sistema en vivo

1. Abrir en un dispositivo:
   - `https://TU_FRONTEND.vercel.app/admin?room=estaca1`
2. Abrir en otro dispositivo/pestaña:
   - `https://TU_FRONTEND.vercel.app/display?room=estaca1`
3. Crear discursantes y presionar **Iniciar**.
4. Confirmar sincronización en ambos.
5. Probar reconexión: recargar display y verificar que se resincroniza solo.

---

## Variables de entorno

### Backend (`server/.env`)

- `PORT=4000`
- `CLIENT_URL=http://localhost:5173` (o dominio Vercel en prod)

### Frontend (`client/.env`)

- `VITE_SOCKET_URL=http://localhost:4000` (o URL Render en prod)

---

## Limitaciones del free tier

- **Render free** puede “dormir” el servicio por inactividad (cold start inicial de algunos segundos).
- Recursos limitados de CPU/RAM para eventos muy grandes.
- Sin persistencia de base de datos: estado en memoria (si reinicia backend, se pierde agenda activa).

---

## Roadmap sugerido

- Persistencia en Redis o Postgres.
- Roles/clave admin.
- Sonido/alertas y overtime.
- Tema oscuro/claro personalizable.
