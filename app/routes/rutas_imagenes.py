from fastapi import APIRouter, UploadFile, File
import asyncio
import json
from fastapi.responses import StreamingResponse
from app.services.redis_client import encolar_tarea, obtener_tarea

router = APIRouter()

@router.post("/imagen/procesar")
async def procesar_imagen(file: UploadFile = File(...)):
    task_id = encolar_tarea("imagen", {"archivo": file.filename})
    return {"task_id": task_id, "status": "pendiente"}

@router.get("/imagen/status/{task_id}")
async def status_tarea(task_id: str):
    tarea = obtener_tarea(task_id)
    if not tarea:
        return {"error": "Tarea no encontrada"}
    return tarea

@router.get("/imagen/stream/{task_id}")
async def stream_status(task_id: str):
    async def eventos():
        while True:
            tarea = obtener_tarea(task_id)
            if not tarea:
                break
            
            yield f"data: {json.dumps(tarea)}\n\n"
            
            if tarea["status"] in ("completada", "error"):
                break
            
            await asyncio.sleep(0.5)
    
    return StreamingResponse(eventos(), media_type="text/event-stream")
