from fastapi import APIRouter, UploadFile, File, Form
import asyncio
import json
import os
import uuid
from fastapi.responses import StreamingResponse, FileResponse
from app.services.redis_client import encolar_tarea, obtener_tarea, stream_tarea
from app.services.s3_client import subir_archivo, s3, BUCKET

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/imagen/procesar")
async def procesar_imagen(
    file: UploadFile = File(...),
    operacion: str = Form(...),
    formato: str = Form(None),
    ancho: int = Form(None),
    alto: int = Form(None),
    filtro: str = Form(None),
):
    ext = os.path.splitext(file.filename)[1]
    nombre = f"{uuid.uuid4()}{ext}"
    ruta = os.path.join(UPLOAD_DIR, nombre)

    with open(ruta, "wb") as f:
        contenido = await file.read()
        f.write(contenido)

    # Subir a S3
    subir_archivo(ruta, f"uploads/{nombre}")

    task_id = encolar_tarea("imagen", {
        "archivo": file.filename,
        "ruta": ruta,
        "s3_key": f"uploads/{nombre}",
        "operacion": operacion,
        "formato": formato,
        "ancho": ancho,
        "alto": alto,
        "filtro": filtro,
    })
    return {"task_id": task_id, "status": "pendiente"}

@router.get("/imagen/status/{task_id}")
async def status_tarea(task_id: str):
    tarea = obtener_tarea(task_id)
    if not tarea:
        return {"error": "Tarea no encontrada"}
    return tarea

@router.get("/imagen/stream/{task_id}")
async def stream_status(task_id: str):
    return await stream_tarea(task_id)

@router.get("/imagen/descargar/{task_id}")
async def descargar_imagen(task_id: str):
    tarea = obtener_tarea(task_id)
    if not tarea:
        return {"error": "Tarea no encontrada"}
    if tarea["status"] != "completada":
        return {"error": "La tarea aún no está completada"}

    ruta = tarea["resultado"]
    nombre_s3 = f"outputs/{os.path.basename(ruta)}"
    
    url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET, 'Key': nombre_s3},
        ExpiresIn=3600  # URL válida por 1 hora
    )
    
    return {"url": url}
