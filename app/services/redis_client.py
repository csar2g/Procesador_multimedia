from fastapi.responses import StreamingResponse
import redis
import json
import uuid
import asyncio
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
r = redis.from_url(REDIS_URL, decode_responses=True)

def encolar_tarea(tipo: str, payload: dict) -> str:
    task_id = str(uuid.uuid4())
    tarea = {
        "id": task_id,
        "tipo": tipo,
        "status": "pendiente",
        "payload": payload
    }
    r.set(f"tarea:{task_id}", json.dumps(tarea))
    r.lpush("cola:tareas", json.dumps(tarea))
    return task_id

def obtener_tarea(task_id: str) -> dict:
    raw = r.get(f"tarea:{task_id}")
    return json.loads(raw) if raw else None

async def stream_tarea(task_id: str):
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

if __name__ == "__main__":
    id = encolar_tarea("imagen", {"archivo": "foto.jpg", "operacion": "resize"})
    print("Tarea creada:", id)
    print("En Redis:", obtener_tarea(id))
