# Procesador de Imágenes y  Descarga de Videos

Sistema distribuido de procesamiento de media con cola de mensajes, workers en Docker y API asíncrona con FastAPI.

---

## ¿Qué hace el proyecto?

- **Procesar imágenes** — redimensionar, aplicar filtros (escala de grises, blur, sharpen, sepia) y convertir entre formatos (JPG, PNG, WebP, BMP)
- **Descargar videos de YouTube** — en formato MP4 (video) o MP3 (solo audio)
- **Ver el estado en tiempo real** — cada tarea muestra su progreso (pendiente → en proceso → completada) sin recargar la página, usando SSE
- **Descargar el resultado** — el archivo procesado se puede descargar directamente desde la interfaz
- **Subir archivos directo a S3** — usando Signed POST, el archivo va directo al bucket sin pasar por el servidor

---
## Flujo de una tarea

1. El usuario sube una imagen o pega una URL de YouTube
2. El frontend hace un `fetch` POST a FastAPI
3. FastAPI guarda la tarea en Redis (`SET`) y la encola (`LPUSH`)
4. Uno de los 3 workers hace `BRPOP` y toma la tarea
5. El worker actualiza el status: `pendiente → en_proceso → completada`
6. El frontend recibe actualizaciones via **SSE** sin recargar
7. El archivo resultante se sube a S3 y el usuario lo descarga

---

## Estructura del proyecto

```
Procesador_multimedia/
├── docker-compose.yml          # Orquesta todos los servicios
├── Dockerfile                  # Imagen de la API
├── requirements.txt            # Dependencias Python
│
├── app/
│   ├── main.py                 # Punto de entrada FastAPI
│   ├── routes/
│   │   ├── rutas_imagenes.py   # Endpoints de imagen
│   │   ├── rutas_youtube.py    # Endpoints de YouTube
│   │   └── rutas_s3.py         # Endpoint de Signed POST
│   ├── services/
│   │   ├── redis_client.py     # Conexión y funciones de Redis
│   │   └── s3_client.py        # Conexión y funciones de S3
│   └── workers/
│       ├── worker.py           # Lógica de procesamiento
│       └── Dockerfile          # Imagen de los workers
│
└── frontend/
    ├── index.html              # UI completa
    ├── css/
    │   └── styles.css          # Estilos y animaciones
    └── js/
        └── app.js              # Lógica del frontend
```

---
## Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `REDIS_URL` | URL de conexión a Redis | `redis://localhost:6379/0` |
| `WORKER_ID` | Identificador del worker | auto-generado |
| `AWS_BUCKET_NAME` | Nombre del bucket S3 | csar2g-objects |
| `AWS_REGION` | Región de AWS | `us-east-1` |

---
## Tecnologías

| Capa         | Tecnología                                 |
| ------------ | ------------------------------------------ |
| Frontend     | HTML5, CSS3, JavaScript Vanilla, SSE       |
| Backend      | Python 3.14, FastAPI, Uvicorn (async)      |
| Cola         | Redis 7 (LPUSH/BRPOP)                      |
| Workers      | Pillow (imágenes), yt-dlp + ffmpeg (video) |
| Storage      | AWS S3 (boto3)                             |
| Contenedores | Docker, Docker Compose                     |
| Cloud        | AWS EC2                                    |

---

## Rúbrica de evaluación

### Unidad 3 — Frontend en JavaScript
 
| Criterio | Cómo se integró en el proyecto |
|---|---|
| **Event Handlers** | Se manejan eventos en toda la interfaz — botones, selectores, el área de arrastre de imágenes y el campo de URL de YouTube, cada uno con su comportamiento específico |
| **Uso de APIs propios con fetch** | El frontend se comunica con la API para enviar imágenes, encolar descargas de YouTube, consultar el estado de las tareas, abrir conexiones en tiempo real y obtener los archivos procesados |
| **Almacenamiento usando Storage** | El historial de las últimas 4 tareas se guarda en el almacenamiento local del navegador. Al recargar la página, las tarjetas se restauran automáticamente con el estado actual de cada tarea |
| **Modificar el DOM** | Las tarjetas de tareas se crean y actualizan dinámicamente. El estado, el botón de descarga y la preview del resultado aparecen y cambian en tiempo real sin recargar la página |
| **Animación** | Se aplican animaciones al aparecer nuevas tarjetas, al indicar que una tarea está en proceso, y al interactuar con el área de carga y los botones |
| **Interacción con AWS usando Signed Posts** | Al subir una imagen, el archivo se envía directamente al bucket de S3 desde el browser usando una firma temporal generada por el servidor, sin que el archivo pase por FastAPI |
| **Otros componentes: Drag & Drop** | El área de subida acepta imágenes arrastradas desde el explorador. Al soltar el archivo se valida, se muestra una preview y queda listo para enviarse |
 
---
 
### Unidad 4 — Cloud
 
| Criterio | Cómo se integró en el proyecto |
|---|---|
| **Instancia, Nix, Puertos, IP Estática** | El proyecto corre en una instancia EC2 de AWS Academy con el puerto 8000 abierto para acceso público. La IP de la instancia se usa para acceder a la aplicación desde cualquier navegador |
| **Uso de Docker para workers distribuidos** | Se levantan 3 workers en contenedores Docker separados. Los 3 procesan tareas en paralelo tomándolas de la misma cola, sin interferirse entre sí |
| **Despliegue con Docker Compose** | Un solo archivo de configuración define y orquesta los 5 servicios del sistema. Con un solo comando se construyen las imágenes, se configuran las conexiones entre servicios y se levantan todos los contenedores |
| **Uso correcto de Queues con Redis** | Redis actúa como intermediario entre la API y los workers. La API deposita tareas en la cola y los workers las consumen en orden, garantizando que ninguna tarea se procese dos veces |
| **FastAPI con servidor asíncrono** | Todos los endpoints manejan peticiones de forma asíncrona, permitiendo atender múltiples usuarios simultáneamente y mantener conexiones SSE abiertas sin bloquear el servidor |
 

