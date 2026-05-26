import json
import redis

r = redis.from_url("redis://localhost:6379/0", decode_responses=True)

def procesar_tarea(tarea: dict):
    print(f"Procesando tarea {tarea['id']} — {tarea['payload']}")
    # logica
    ###

def main():
    print("Worker iniciado, esperando tareas...")
    while True:
        _, raw = r.brpop("cola:tareas")
        tarea = json.loads(raw)
        
        # Marcar como en proceso
        tarea["status"] = "en_proceso"
        r.set(f"tarea:{tarea['id']}", json.dumps(tarea))
        
        # Procesar
        procesar_tarea(tarea)
        
        # Marcar como completada
        tarea["status"] = "completada"
        r.set(f"tarea:{tarea['id']}", json.dumps(tarea))

if __name__ == "__main__":
    main()
