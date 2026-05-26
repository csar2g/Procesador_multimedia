import redis
import json
import uuid

r = redis.from_url("redis://localhost:6379/0", decode_responses = True)

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


if __name__ == "__main__":
    id = encolar_tarea("imagen", {"archivo": "foto.jpg", "operacion": "resize"})
    print("Tarea creada:", id)
    print("En Redis:", obtener_tarea(id))
