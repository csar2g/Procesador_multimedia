from fastapi import APIRouter, Form
from app.services.redis_client import encolar_tarea, obtener_tarea, stream_tarea
from fastapi.responses import FileResponse
import os

router = APIRouter()

@router.post("/youtube/descargar")
async def descargar_youtube(
    url: str = Form(...),
    formato: str = Form(...)  # mp3/mp4
):
    task_id = encolar_tarea("youtube", {
        "url": url,
        "formato": formato
    })
    return {"task_id": task_id, "status": "pendiente"}

@router.get("/youtube/status/{task_id}")
async def status_tarea(task_id: str):
    tarea = obtener_tarea(task_id)
    if not tarea:
        return {"error": "Tarea no encontrada"}
    return tarea

@router.get("/youtube/stream/{task_id}")
async def stream_status(task_id: str):
    return await stream_tarea(task_id)

@router.get("/youtube/descargar/{task_id}")
async def descargar_resultado(task_id: str):
    tarea = obtener_tarea(task_id)
    if not tarea:
        return {"error": "Tarea no encontrada"}
    if tarea["status"] != "completada":
        return {"error": "La tarea aún no está completada"}
    
    ruta = tarea["resultado"]
    return FileResponse(ruta, filename=os.path.basename(ruta))
