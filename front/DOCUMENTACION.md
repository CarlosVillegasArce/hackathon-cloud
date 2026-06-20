# Documentación — Frontend Triaje Inteligente de Reclamos

**Proyecto:** Hackathon 2026 · Triaje Inteligente de Reclamos Ciudadanos
**Componente:** Frontend (React + Vite + Tailwind)
**Ubicación:** `/Users/miguelangelmori/Documents/Proyectos/triaje-frontend`
**Autor de la implementación:** Asistido por Claude Code
**Última actualización:** 2026-06-20

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura del proyecto](#3-estructura-del-proyecto)
4. [Detalle de cada archivo](#4-detalle-de-cada-archivo)
5. [Flujos principales](#5-flujos-principales)
6. [Sistema de modo demo](#6-sistema-de-modo-demo)
7. [Manejo de errores](#7-manejo-de-errores)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Cómo correrlo localmente](#9-cómo-correrlo-localmente)
10. [Cómo conectar con el backend](#10-cómo-conectar-con-el-backend)
11. [Formato del CSV y archivos de ejemplo](#11-formato-del-csv-y-archivos-de-ejemplo)
12. [Decisiones de diseño](#12-decisiones-de-diseño)
13. [Checklist de pendientes para producción](#13-checklist-de-pendientes-para-producción)

---

## 1. Resumen ejecutivo

Este frontend resuelve dos casos de uso para una entidad pública que recibe reclamos ciudadanos en lote:

- **Caso A — Carga masiva:** un operador sube un archivo CSV con cientos de reclamos en texto libre. Cada fila se envía al backend, que la clasifica con IA (Gemini) y la deriva al área correspondiente.
- **Caso B — Visualización del triaje:** el operador ve los reclamos procesados con su clasificación (tipo, urgencia, área, resumen) y puede filtrar/inspeccionar cada caso.

El frontend **no contiene lógica de backend**. Solo consume dos endpoints expuestos por el equipo de infraestructura:

| Endpoint | Propósito |
|---|---|
| `POST {VITE_PRESIGN_URL}` | Solicita una URL prefirmada de S3 para subir el CSV directamente. |
| `GET {VITE_API_URL}/reclamos` | Devuelve el array de reclamos ya procesados. |

Mientras el backend no esté desplegado, el front opera en **modo demo** con datos mock realistas para no bloquear el desarrollo de la UI.

---

## 2. Stack tecnológico

| Categoría | Tecnología | Versión | Por qué |
|---|---|---|---|
| Framework | React | 19.x | Estándar del prompt. |
| Bundler / dev server | Vite | 8.x | Arranque rápido (~90ms), HMR, sin configuración. |
| Routing | React Router | 7.x | URLs compartibles (`/upload`, `/resultados`), soporte para refresh. |
| Estilos | Tailwind CSS | 3.4 | Utility-first, sin sobre-ingeniería, paleta customizable. |
| Parseo CSV | PapaParse | 5.x | Parsing en el navegador, soporta archivos grandes vía streaming. |
| Estado | React useState/useEffect | — | No se justifica Redux ni React Query para este alcance. |
| Notificaciones | Custom (ToastContext) | — | Evita una dependencia extra para algo simple. |

**No se usaron** (decisión consciente):
- Redux / Zustand / Jotai
- React Query / SWR
- Librerías de UI (MUI, shadcn) — Tailwind directo es suficiente
- TypeScript — el prompt no lo requería, JavaScript mantiene el código accesible para todo el equipo

---

## 3. Estructura del proyecto

```
triaje-frontend/
├── public/
│   ├── reclamos-ejemplo.csv          # CSV genérico (8 filas)
│   ├── reclamos-municipales.csv      # 10 reclamos para Municipalidad
│   ├── reclamos-telecomunicaciones.csv # 10 reclamos para Osiptel
│   ├── reclamos-consumo.csv          # 10 reclamos para Indecopi
│   └── reclamos-variados.csv         # 12 reclamos mezclados
│
├── src/
│   ├── components/                   # Piezas UI reutilizables
│   │   ├── Layout.jsx                # Header + nav + footer (compartido)
│   │   ├── CsvDropzone.jsx           # Drag & drop de archivos
│   │   ├── CsvPreview.jsx            # Tabla preview + validación columnas
│   │   ├── UploadStages.jsx          # Stepper de estados de subida
│   │   ├── ReclamoCard.jsx           # Tarjeta de reclamo individual
│   │   ├── ReclamoModal.jsx          # Modal de detalle
│   │   └── UrgencyBadge.jsx          # Badge de color por urgencia
│   │
│   ├── pages/                        # Vistas de cada ruta
│   │   ├── UploadPage.jsx            # /upload
│   │   └── ResultadosPage.jsx        # /resultados
│   │
│   ├── lib/                          # Servicios y utilidades sin React
│   │   ├── env.js                    # Lectura de variables de entorno
│   │   ├── uploadService.js          # Lógica de subida (real + demo)
│   │   ├── reclamosService.js        # Lógica de fetch (real + demo)
│   │   └── demoData.js               # Mocks para modo demo
│   │
│   ├── hooks/
│   │   └── useReclamos.js            # Hook de polling
│   │
│   ├── context/
│   │   └── ToastContext.jsx          # Provider de notificaciones
│   │
│   ├── App.jsx                       # Definición de rutas
│   ├── main.jsx                      # Entry point
│   └── index.css                     # Tailwind + estilos base
│
├── .env                              # Variables locales (gitignored)
├── .env.example                      # Plantilla documentada
├── .gitignore
├── DOCUMENTACION.md                  # Este archivo
├── README.md                         # Quick start
├── index.html                        # Shell HTML
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

---

## 4. Detalle de cada archivo

### 4.1 Entry points

#### `index.html`
- HTML base. Importante: `lang="es"`, preconnects a Google Fonts y carga de Inter (400, 500, 600, 700).
- Punto de inyección: `<div id="root"></div>`.

#### `src/main.jsx`
- Monta la aplicación en `#root`.
- Encadena 3 providers: `StrictMode` → `BrowserRouter` → `ToastProvider` → `App`.
- Importa `index.css` para activar Tailwind globalmente.

#### `src/App.jsx`
- Define el árbol de rutas:
  - `/` → redirige a `/upload`
  - `/upload` → `<UploadPage />`
  - `/resultados` → `<ResultadosPage />`
  - `*` → redirige a `/upload`
- Todas las rutas viven dentro de `<Layout>` vía `<Outlet />`.

### 4.2 Estilos

#### `src/index.css`
- Tres directivas `@tailwind`.
- Layer `base`: configura `body` con fondo `slate-50`, color de texto y fuente Inter.
- Layer `components`: clases reutilizables `.btn`, `.btn-primary`, `.btn-secondary`, `.card`, `.badge` para no repetir cadenas Tailwind largas.

#### `tailwind.config.js`
- Paleta extendida `brand` (azules institucionales del 50 al 900).
- Fuente `sans` apuntando a Inter con fallbacks de sistema.
- Content paths: `index.html` + todos los `.jsx` de `src/`.

#### `postcss.config.js`
- Estándar: `tailwindcss` + `autoprefixer`.

### 4.3 Servicios (capa de datos)

#### `src/lib/env.js`
- Exporta las 4 variables (`API_URL`, `PRESIGN_URL`, `BUCKET_NAME`) y la función `isDemoMode()`.
- `isDemoMode()` tiene fallback inteligente: si la variable no está definida, deduce el modo según si hay URLs configuradas. Eso evita romper la app por olvidos de configuración.

#### `src/lib/uploadService.js`
- Exporta `uploadCsv({ file, onProgress })`.
- **Flujo real:**
  1. `POST {PRESIGN_URL}` con `{ filename, contentType }` → `{ uploadUrl, key }`.
  2. `PUT {uploadUrl}` con el archivo binario y `Content-Type: text/csv`.
  3. Emite eventos `requesting` → `uploading` → `queued` vía `onProgress`.
- **Flujo demo (`runDemoUpload`):** simula las 3 etapas con `setTimeout` y devuelve un key fake.
- Manejo robusto: extrae el body de respuesta cuando hay error, hace `await safeText()` para no romper si no es JSON.

#### `src/lib/reclamosService.js`
- Exporta `fetchReclamos({ signal })`.
- Acepta `AbortSignal` para cancelar peticiones en vuelo (importante con polling + StrictMode).
- Tolera dos formatos de respuesta del backend: `Array` directo o `{ items: [...] }`.
- En modo demo llama a `nextDemoBatch()` que va revelando 2 reclamos por llamada.

#### `src/lib/demoData.js`
- Set de 6 reclamos realistas en español peruano cubriendo Alta/Media/Baja y áreas Municipalidad/Osiptel/Indecopi.
- `nextDemoBatch()` mantiene un contador interno y retorna prefijos crecientes — simula que el Worker va terminando trabajos uno a uno.
- `resetDemoBatch()` se llama cuando se sube un nuevo CSV en modo demo para reiniciar la simulación.

### 4.4 Hook personalizado

#### `src/hooks/useReclamos.js`
- Encapsula toda la lógica de fetch + polling.
- `useEffect` arranca un `setInterval` de 6 segundos.
- Cada nueva llamada cancela la anterior con `AbortController` (evita race conditions).
- Limpieza correcta en unmount.
- Retorna `{ items, loading, error, lastUpdated, isDemo, refetch }`.

### 4.5 Context (notificaciones)

#### `src/context/ToastContext.jsx`
- Sistema mínimo de toasts (success/error/info), auto-dismiss a 4.5s.
- Hook `useToast()` con API simple: `toast.success(msg)`, `toast.error(msg)`, etc.
- Render en un viewport fijo arriba a la derecha con estilos según tipo.
- Atributo `role="alert"` para errores (accesibilidad).

### 4.6 Layout

#### `src/components/Layout.jsx`
- Header con logo (icono SVG inline), título y nav con `NavLink` de React Router (resalta la ruta activa).
- Banner amarillo de modo demo (condicional vía `isDemoMode()`).
- `<Outlet />` para renderizar la ruta hija.
- Footer discreto.

### 4.7 Componentes de Upload

#### `src/components/CsvDropzone.jsx`
- Drop zone con estados `idle | dragging | disabled`.
- Botón "selecciónalo" alternativo al drag.
- Input `<file>` oculto con `accept=".csv,text/csv"`.
- Valida extensión antes de pasar el archivo al padre.

#### `src/components/CsvPreview.jsx`
- Tabla con las primeras 5 filas del CSV.
- Dos badges arriba indicando si `id_reclamo` y `texto` están presentes (verde/rojo).
- Banner rojo si falta alguna columna obligatoria.
- Exporta `validateCsvHeaders()` para que `UploadPage` no duplique la lógica.

#### `src/components/UploadStages.jsx`
- Stepper visual con 4 estados:
  1. Solicitando URL prefirmada
  2. Subiendo a S3
  3. Encolando para procesamiento
  4. Listo
- Estilo: pendientes en gris, activo en azul con animación pulse, completados en verde con check.

### 4.8 Componentes de Resultados

#### `src/components/ReclamoCard.jsx`
- Botón clickeable (accesible con teclado, focus ring).
- Muestra: `#id`, tipo, badge urgencia, resumen (truncado a 3 líneas), área, link "Ver detalle".

#### `src/components/UrgencyBadge.jsx`
- Badge con colores según `value`:
  - `Alta` → rojo
  - `Media` → ámbar
  - `Baja` → verde
  - Otro/vacío → gris
- Case-insensitive (`'alta'` y `'Alta'` igual).

#### `src/components/ReclamoModal.jsx`
- Modal accesible:
  - `role="dialog"`, `aria-modal`, `aria-labelledby`.
  - Cierra con ESC, click fuera, botón × o "Cerrar".
- Muestra: ID, tipo, urgencia, área, resumen y texto original completo en bloque `whitespace-pre-wrap`.

### 4.9 Páginas

#### `src/pages/UploadPage.jsx`
- Orquesta dropzone + preview + servicio + stepper.
- Estado local: archivo, headers, filas preview, error de parseo, validación, etapa, resultado, error de upload.
- Función `handleFile`: dispara `Papa.parse()` y valida columnas.
- Función `handleUpload`: llama `uploadCsv()` con callbacks de progreso.
- Función `resetAll`: limpia todo (para botón "Quitar archivo").
- Render condicional: dropzone siempre, preview cuando hay archivo, tarjeta de control cuando hay archivo, stepper cuando hay subida en curso, mensaje de éxito cuando termina.

#### `src/pages/ResultadosPage.jsx`
- Llama `useReclamos()` para datos con polling.
- Calcula con `useMemo`: áreas únicas, lista filtrada, conteos por urgencia.
- Componentes internos:
  - `FilterSelect` — `<select>` con label y opciones
  - `StatCard` — tarjeta de KPI con tono según urgencia
  - `EmptyState` — placeholder cuando no hay datos
  - `SkeletonGrid` — 6 skeletons animados durante la carga inicial
- Cuatro escenarios de render:
  - Error de red → `EmptyState` con botón Reintentar
  - Sin items + filtros activos → `EmptyState` "Sin coincidencias"
  - Sin items + sin filtros → `EmptyState` "Aún no hay resultados"
  - Loading + sin items → `SkeletonGrid`
  - Con items → grid de `ReclamoCard`

### 4.10 Configuración

#### `.env.example`
- Plantilla con las 4 variables documentadas.

#### `.env`
- Mismo contenido pero con `VITE_DEMO_MODE=true` por defecto.
- Está en `.gitignore`.

#### `.gitignore`
- Estándar de Vite + agregado: `.env` y `.env.*.local`.

#### `package.json`
- Scripts: `dev`, `build`, `lint`, `preview`.
- Dependencias mínimas: react, react-dom, react-router-dom, papaparse.
- DevDependencies: vite, tailwindcss, postcss, autoprefixer, eslint.

---

## 5. Flujos principales

### 5.1 Flujo de Upload

```
Usuario llega a /upload
        ↓
Arrastra o selecciona archivo .csv
        ↓
CsvDropzone valida extensión
        ↓
Papa.parse() en el navegador
        ↓
¿Tiene id_reclamo y texto?
        ├── No → toast rojo + badge rojo, botón deshabilitado
        └── Sí → muestra preview + habilita "Iniciar procesamiento"
                        ↓
                  Click en "Iniciar procesamiento"
                        ↓
              uploadService.uploadCsv({ file, onProgress })
                        ↓
              [Stage 1] POST /presigned-url → { uploadUrl, key }
                        ↓
              [Stage 2] PUT {uploadUrl} con el archivo
                        ↓
              [Stage 3] queued → mensaje verde + botón "Ver resultados"
```

### 5.2 Flujo de Resultados

```
Usuario llega a /resultados
        ↓
useReclamos() arranca fetch inicial + setInterval(6s)
        ↓
[cada 6s] fetchReclamos({ signal })
        ↓
GET {API_URL}/reclamos
        ↓
        ├── 200 OK → setItems(data), setLastUpdated(now)
        ├── 4xx/5xx → setError(detalle)
        └── network error → setError(mensaje)
        ↓
Render condicional según estado
        ↓
Click en card → setSelected(reclamo) → abre <ReclamoModal />
```

---

## 6. Sistema de modo demo

El modo demo es **un toggle global** que reemplaza las llamadas reales por mocks locales. Diseñado para que el frontend funcione completo sin esperar al backend.

### Cómo se activa
- Vía `.env`: `VITE_DEMO_MODE=true`
- Si la variable no está definida, se infiere `true` cuando no hay URLs configuradas.

### Qué cambia en demo
- `uploadCsv()` no contacta a S3. Llama `runDemoUpload()` que simula 3 etapas con `setTimeout`.
- `fetchReclamos()` no contacta al API. Devuelve `nextDemoBatch()` que progresivamente revela 6 reclamos mock realistas.
- En el header aparece un **banner amarillo** indicando claramente el modo.

### Cómo desactivarlo
```env
VITE_DEMO_MODE=false
VITE_API_URL=https://...
VITE_PRESIGN_URL=https://...
```
El front detecta el cambio en el siguiente reinicio del dev server o build.

### Por qué se diseñó así
- **Aislamiento**: la lógica demo vive en `runDemoUpload()` y `demoData.js`. Borrar el modo demo es eliminar esas funciones sin tocar el resto.
- **Realismo**: los datos mock son frases naturales en español peruano, no lorem ipsum. Eso permite probar visualmente filtros, badges y modal con datos significativos.
- **Visibilidad**: el banner amarillo evita confusión sobre si los datos son reales.

---

## 7. Manejo de errores

| Escenario | Comportamiento |
|---|---|
| Archivo no es `.csv` | Toast rojo en el dropzone. No se procesa. |
| CSV mal formado | Mensaje inline rojo con detalle de PapaParse + toast. |
| Falta columna `id_reclamo` o `texto` | Banner rojo en preview + badges rojos + botón "Iniciar" deshabilitado + toast. |
| `POST /presigned-url` falla | Mensaje inline rojo con status + body + toast. Botón "Iniciar" vuelve a estar disponible. |
| `PUT` a S3 falla | Mismo tratamiento que el anterior. |
| `GET /reclamos` falla | EmptyState central con mensaje + botón "Reintentar". El polling sigue activo. |
| `GET /reclamos` devuelve vacío | EmptyState "Aún no hay resultados" + hint contextual. |
| Backend no desplegado | Mantén `VITE_DEMO_MODE=true` y todo funciona contra mocks. |
| Filtros sin coincidencias | EmptyState "Sin coincidencias". |
| Pérdida de red durante polling | El intervalo siguiente reintenta. No hay backoff exponencial — alcance del hackathon. |

**Principio aplicado:** nunca un `console.log` silencioso como única señal de error. Todos los errores generan toast + render visible.

---

## 8. Variables de entorno

| Variable | Tipo | Default | Descripción |
|---|---|---|---|
| `VITE_API_URL` | string (URL) | `""` | Base del API Gateway. Se concatena con `/reclamos`. |
| `VITE_PRESIGN_URL` | string (URL) | `""` | Endpoint que firma URLs de subida a S3. |
| `VITE_BUCKET_NAME` | string | `""` | Solo referencial (el bucket lo resuelve el backend). |
| `VITE_DEMO_MODE` | `"true"` / `"false"` | `true` (vía `.env`) | Activa modo demo. |

**Importante:**
- Las variables `VITE_*` se inyectan en build time. Cambios en `.env` requieren reiniciar `npm run dev`.
- Nunca uses estas variables para secretos: están embebidas en el bundle público.
- Para credenciales AWS, el backend debe firmar URLs prefirmadas con sus propias credenciales — el front nunca debe tener IAM keys.

---

## 9. Cómo correrlo localmente

### Primera vez
```bash
cd /Users/miguelangelmori/Documents/Proyectos/triaje-frontend
npm install
cp .env.example .env       # ya existe, pero por si lo borras
npm run dev
```

Abre `http://localhost:5173/`.

### Comandos disponibles
| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server con HMR en `:5173`. |
| `npm run build` | Build de producción en `dist/`. |
| `npm run preview` | Sirve el build en `:4173`. |
| `npm run lint` | Corre ESLint. |

### Verificación rápida del setup
Después de `npm run dev`, deberías ver:
- Banner amarillo de modo demo en el header.
- En `/upload`: dropzone visible.
- En `/resultados`: stat cards en 0, luego polling rellena progresivamente hasta 6 reclamos.

---

## 10. Cómo conectar con el backend

### Pasos cuando el backend esté listo

1. Editar `.env`:
   ```env
   VITE_DEMO_MODE=false
   VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev
   VITE_PRESIGN_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev/presigned-url
   VITE_BUCKET_NAME=reclamos-ingest-dev
   ```
2. Reiniciar `npm run dev`.
3. El banner amarillo desaparece automáticamente.

### Contrato esperado del backend

#### `POST {VITE_PRESIGN_URL}`

**Request:**
```json
{
  "filename": "reclamos-2026-06-20.csv",
  "contentType": "text/csv"
}
```

**Response 200:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...firmada...",
  "key": "ingesta/2026-06-20/reclamos-abc123.csv"
}
```

#### `PUT {uploadUrl}`
- Headers: `Content-Type: text/csv`
- Body: archivo binario
- Response: 200 (con body vacío es ok)

#### `GET {VITE_API_URL}/reclamos`

**Response 200:**
```json
[
  {
    "id_reclamo": "001",
    "texto_original": "El semáforo de la Av. Principal...",
    "tipo": "Infraestructura vial",
    "urgencia": "Alta",
    "area": "Municipalidad - Tránsito",
    "resumen": "Semáforo malogrado representa riesgo de accidente."
  }
]
```

También se acepta `{ "items": [...] }` por flexibilidad.

### CORS
El backend debe permitir el origen del front (en dev: `http://localhost:5173`). Headers mínimos:
```
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Para el `PUT` a S3, la bucket policy o la presigned URL deben permitir `text/csv`.

---

## 11. Formato del CSV y archivos de ejemplo

### Columnas obligatorias

| Columna | Tipo | Descripción |
|---|---|---|
| `id_reclamo` | string | Identificador único del reclamo. Puede tener el prefijo que prefieras (ej. `R-0001`, `RM-2001`). |
| `texto` | string | El reclamo en texto libre, tal como lo escribió o dictó el ciudadano. |

### Reglas
- Las columnas se detectan **case-insensitive** (`ID_RECLAMO` o `id_reclamo` ambas valen).
- El CSV puede tener más columnas — se ignoran sin error.
- Si el texto contiene comas, va entre comillas dobles `"..."`. Comillas internas se escapan duplicándolas (`""`).
- Codificación recomendada: UTF-8 (para tildes y ñ).

### Archivos de ejemplo incluidos

Todos están en `public/` y son accesibles localmente. Puedes arrastrarlos directo del Finder a la dropzone, o descargarlos desde el dev server (ej. `http://localhost:5173/reclamos-municipales.csv`).

| Archivo | Filas | Escenario | Áreas esperadas |
|---|---|---|---|
| `reclamos-ejemplo.csv` | 8 | Genérico — mezcla de los tres dominios. | Municipalidad, Osiptel, Indecopi |
| `reclamos-municipales.csv` | 10 | Solo reclamos para la Municipalidad. | Tránsito, Limpieza, Defensa Civil, Obras |
| `reclamos-telecomunicaciones.csv` | 10 | Solo telecomunicaciones (Movistar, Claro, Bitel, Entel). | Osiptel — Reclamos telecomunicaciones |
| `reclamos-consumo.csv` | 10 | Solo protección al consumidor. | Indecopi — Protección al consumidor |
| `reclamos-variados.csv` | 12 | Set mixto con frases más cortas y diversos sectores. | Múltiples |

### Ejemplo mínimo del formato

```csv
id_reclamo,texto
R-0001,"El semáforo de la Av. Principal lleva 3 días malogrado."
R-0002,"Movistar me cobra doble desde marzo."
```

### Errores comunes y cómo evitarlos

| Error | Causa | Solución |
|---|---|---|
| Badge rojo "id_reclamo" | La columna no existe o está mal escrita | Renombra la cabecera exactamente a `id_reclamo`. |
| Caracteres raros (`Ã¡`, `Ã±`) | El CSV está en Windows-1252 o Latin1 | Guarda como UTF-8 desde Excel/Google Sheets. |
| Filas pegadas en una sola celda | Separador equivocado (`;` en lugar de `,`) | Reabre y exporta con coma. |
| Comillas mal escapadas | Comillas internas sin duplicar | Reemplaza `"` interno por `""` o re-exporta. |

---

## 12. Decisiones de diseño

### UX
- **Paleta gubernamental neutra** (azul `brand-700` + slate). Evita tonos vibrantes que podrían interpretarse como informales.
- **Banner de demo siempre visible** cuando aplica — la transparencia evita confusiones en demos.
- **Stat cards arriba** del dashboard: la urgencia es el dato más operativamente importante y debe verse primero.
- **Modal en lugar de página de detalle**: para hackathon es más fluido y mantiene el contexto del listado.

### Técnicas
- **Polling simple en lugar de WebSocket**: el prompt lo permite y reduce dependencias del backend.
- **AbortController en cada fetch**: evita race conditions cuando el polling dispara más rápido que la respuesta.
- **`useMemo` para listas derivadas**: filtros, áreas únicas y conteos no se recalculan en cada render.
- **Validación de columnas case-insensitive**: tolera CSVs exportados desde distintas herramientas.
- **Sin TypeScript**: scope de hackathon y el equipo puede no estar familiarizado. Vite + JS es suficiente y rápido.

### Estructura
- **`lib/` separado de `hooks/`**: lo que no es React vive en `lib/` y puede testearse o reusarse en otro proyecto.
- **`pages/` vs `components/`**: las páginas son entrypoints de rutas; los componentes son piezas reutilizables.
- **Servicios con modo demo aislado**: borrar el modo demo es eliminar funciones específicas, no refactorizar lógica entremezclada.

---

## 13. Checklist de pendientes para producción

Cosas que **no se incluyeron** porque están fuera del alcance del hackathon, pero conviene tener en cuenta si esto pasa a producción real:

### Seguridad
- [ ] Autenticación (login de operadores)
- [ ] Autorización por área (solo ver reclamos del área correspondiente)
- [ ] Rate limiting en el endpoint de presigned URL (evitar abuso)
- [ ] Validación del tipo MIME real del archivo en backend
- [ ] CSP headers
- [ ] HTTPS obligatorio

### Performance
- [ ] Paginación / scroll infinito en el dashboard (hoy es un `scan()` completo)
- [ ] Backoff exponencial en polling si hay errores repetidos
- [ ] Reemplazar polling por WebSocket / SSE
- [ ] Code splitting por ruta (lazy load de páginas)

### UX
- [ ] Búsqueda por texto libre en reclamos
- [ ] Exportar reclamos filtrados a CSV
- [ ] Filtros por rango de fechas (cuando el backend incluya `created_at`)
- [ ] Vista de tabla densa además de cards
- [ ] Modo oscuro
- [ ] i18n (hoy todo está hardcoded en español)

### Operación
- [ ] Tests unitarios (Vitest + React Testing Library)
- [ ] Tests E2E (Playwright)
- [ ] CI/CD (GitHub Actions con build + lint + tests)
- [ ] Configurar Sentry o similar para errores en producción
- [ ] Analytics (Plausible / Mixpanel)
- [ ] Documentación con Storybook para los componentes

### Calidad de datos
- [ ] Reintentar reclamos que el Worker falló en clasificar
- [ ] Permitir corrección manual del triaje desde el dashboard
- [ ] Audit log de cambios

---

## Apéndice: contacto y siguientes pasos

- **Repositorio:** carpeta local en `/Users/miguelangelmori/Documents/Proyectos/triaje-frontend` (aún no inicializado como repo git; ver sección [Operación](#13-checklist-de-pendientes-para-producción)).
- **Para integración con backend:** coordinar con el equipo que mantiene el API Gateway + Lambda `presigned-url` y la Lambda `GET /reclamos`.
- **Para demo en hackathon:** mantener modo demo activo. Los datos mock son suficientes para mostrar el flujo completo end-to-end.

Fin del documento.
