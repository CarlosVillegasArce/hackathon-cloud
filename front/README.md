# Triaje Inteligente de Reclamos — Frontend

Frontend del proyecto **Triaje Inteligente de Reclamos Ciudadanos** (hackathon). Permite a operadores de entidades públicas subir un CSV con reclamos en texto libre y visualizar el resultado del triaje automático que produce el backend (Lambda + SQS + Worker EC2 + Gemini + DynamoDB).

> Este repo **solo contiene el frontend**. El backend ya existe en AWS y se consume vía variables de entorno.

## Stack

- React 19 + Vite
- React Router
- Tailwind CSS v3
- PapaParse (parseo de CSV en el navegador)

## Estructura

```
src/
  components/      # CsvDropzone, CsvPreview, UploadStages, ReclamoCard,
                   # ReclamoModal, UrgencyBadge, Layout
  pages/           # UploadPage, ResultadosPage
  lib/             # env, uploadService, reclamosService, demoData
  hooks/           # useReclamos (polling)
  context/         # ToastContext (notificaciones)
  App.jsx
  main.jsx
public/
  reclamos-ejemplo.csv   # CSV de prueba con las columnas correctas
```

## Configuración

1. Copia el archivo de ejemplo y edítalo:
   ```bash
   cp .env.example .env
   ```
2. Variables disponibles:

   | Variable | Descripción |
   |---|---|
   | `VITE_API_URL` | Base del API Gateway. El front llama a `${VITE_API_URL}/reclamos`. |
   | `VITE_PRESIGN_URL` | Endpoint `POST` que devuelve `{ uploadUrl, key }` para subir el CSV directo a S3. |
   | `VITE_BUCKET_NAME` | Solo referencial; el bucket lo resuelve el backend al firmar la URL. |
   | `VITE_DEMO_MODE` | `true` → simula subidas y resultados (sin tocar AWS). `false` → usa los endpoints reales. |

3. **Modo demo** (recomendado mientras el backend aún no está desplegado):
   - Deja `VITE_DEMO_MODE=true`.
   - Las subidas se simulan con `setTimeout` y la pantalla de resultados muestra un set de reclamos mock que crece en cada polling.
   - Aparece un banner amarillo en el header indicándolo.

4. **Modo real** (cuando el backend esté listo):
   ```env
   VITE_DEMO_MODE=false
   VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev
   VITE_PRESIGN_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev/presigned-url
   ```

## Cómo correrlo

```bash
npm install
npm run dev
```

El dev server arranca en [http://localhost:5173](http://localhost:5173).

Comandos útiles:

```bash
npm run build      # build de producción a dist/
npm run preview    # servir el build
npm run lint       # ESLint
```

## Cómo se conecta con el backend

### 1) Subida del CSV (`UploadPage` → `lib/uploadService.js`)

```
[Front]  POST {VITE_PRESIGN_URL}  body: { filename, contentType: 'text/csv' }
              ↓
[Back]   responde { uploadUrl, key }
              ↓
[Front]  PUT {uploadUrl}  body: <archivo CSV>  (Content-Type: text/csv)
              ↓
[S3]     dispara la Lambda dispatcher, que encola las filas en SQS
              ↓
[Worker EC2]  consume SQS → Gemini → DynamoDB (ReclamosProcesados-dev)
```

El front nunca toca AWS directamente: solo habla con el endpoint que entrega la URL prefirmada.

### 2) Visualización (`ResultadosPage` → `hooks/useReclamos` → `lib/reclamosService.js`)

```
[Front]  GET {VITE_API_URL}/reclamos
              ↓
[Back]   Lambda hace scan() sobre DynamoDB y devuelve un array:
         [
           {
             id_reclamo, texto_original, tipo,
             urgencia: 'Alta' | 'Media' | 'Baja',
             area, resumen
           },
           ...
         ]
```

El polling refetch cada 6 segundos. También hay botón de refresh manual.

## CSV esperado

Columnas obligatorias (case-insensitive): `id_reclamo`, `texto`. Otras columnas se aceptan pero se ignoran.

Hay un archivo de prueba en [public/reclamos-ejemplo.csv](public/reclamos-ejemplo.csv).

## Comportamiento ante errores

- **CSV mal formado o sin columnas obligatorias** → mensaje inline + toast, botón "Iniciar procesamiento" deshabilitado.
- **`POST /presigned-url` o `PUT` a S3 fallan** → toast rojo + bloque rojo en pantalla con el detalle del error.
- **`GET /reclamos` falla o devuelve vacío** → empty state amigable con botón "Reintentar"; la app no se rompe.
- **Backend aún no desplegado** → mantén `VITE_DEMO_MODE=true` para iterar la UI sin bloqueos.

## Notas de desarrollo

- Estilo visual: paleta neutra (azul institucional + slate), pensado para uso gubernamental.
- Sin Redux ni React Query. `useState`/`useEffect` + un hook personalizado para el polling.
- Toasts implementados en `context/ToastContext.jsx`, accesibles vía `useToast()`.
