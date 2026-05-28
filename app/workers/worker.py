from PIL import Image
from app.services.s3_client import subir_archivo, descargar_archivo
import json
import redis
import os
import sys

sys.stdout.flush()
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
r = redis.from_url(REDIS_URL, decode_responses=True)
OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def procesar_tarea(tarea: dict):
    payload = tarea["payload"]
    ruta_entrada = payload["ruta"]
    operacion = payload["operacion"]

    # Si no existe local, descarga de S3
    if not os.path.exists(ruta_entrada):
        descargar_archivo(payload["s3_key"], ruta_entrada)

    img = Image.open(ruta_entrada)

    if operacion == "convertir":
        formato = payload["formato"].lower()
        nombre_salida = f"{tarea['id']}.{formato}"
        ruta_salida = os.path.join(OUTPUT_DIR, nombre_salida)
        if formato in ("jpg", "jpeg") and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        formato_pillow = "JPEG" if formato in ("jpg", "jpeg") else formato.upper()
        img.save(ruta_salida, format=formato_pillow)

    elif operacion == "resize":
        ancho = payload["ancho"]
        alto = payload["alto"]
        img = img.resize((ancho, alto))
        nombre_salida = f"{tarea['id']}.png"
        ruta_salida = os.path.join(OUTPUT_DIR, nombre_salida)
        img.save(ruta_salida)

    elif operacion == "filtro":
        from PIL import ImageFilter
        filtro = payload["filtro"]
        if filtro == "grayscale":
            img = img.convert("L")
        elif filtro == "blur":
            img = img.filter(ImageFilter.GaussianBlur(radius=4))
        elif filtro == "sharpen":
            img = img.filter(ImageFilter.SHARPEN)
        elif filtro == "sepia":
            img = img.convert("RGB")
            pixels = img.load()
            for i in range(img.width):
                for j in range(img.height):
                    r, g, b = pixels[i, j]
                    pixels[i, j] = (
                        min(255, int(r*0.393 + g*0.769 + b*0.189)),
                        min(255, int(r*0.349 + g*0.686 + b*0.168)),
                        min(255, int(r*0.272 + g*0.534 + b*0.131)),
                    )
        nombre_salida = f"{tarea['id']}.png"
        ruta_salida = os.path.join(OUTPUT_DIR, nombre_salida)
        img.save(ruta_salida)

    try:
        nombre_s3 = f"outputs/{os.path.basename(ruta_salida)}"
        subir_archivo(ruta_salida, nombre_s3)
    except Exception as e:
        print(f"S3 no disponible, guardando solo local: {e}", flush=True)

    print(f"Imagen guardada en S3: {nombre_s3}", flush=True)
    return ruta_salida

def procesar_youtube(tarea: dict):
    import yt_dlp

    payload = tarea["payload"]
    url = payload["url"]
    formato = payload["formato"]

    output_template = os.path.join(OUTPUT_DIR, f"{tarea['id']}.%(ext)s")

    ydl_opts = {
        "outtmpl": output_template,
        "quiet": False,
        "extractor_args": {"youtube": {"js_runtimes": ["node:/usr/bin/node"]}},
        "compat_opts": {"no-youtube-channel-redirect"},
    }

    if formato == "mp3":
        ydl_opts["format"] = "bestaudio/best"
        ydl_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
        }]
    else:
        ydl_opts["format"] = "best"

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    ext = "mp3" if formato == "mp3" else "mp4"
    return os.path.join(OUTPUT_DIR, f"{tarea['id']}.{ext}")

def main():
    print("Worker iniciado, esperando tareas...", flush=True)
    while True:
        _, raw = r.brpop("cola:tareas")
        tarea = json.loads(raw)

        tarea["status"] = "en_proceso"
        r.set(f"tarea:{tarea['id']}", json.dumps(tarea))

        if tarea["tipo"] == "imagen":
            resultado = procesar_tarea(tarea)
        elif tarea["tipo"] == "youtube":
            resultado = procesar_youtube(tarea)

        tarea["status"] = "completada"
        tarea["resultado"] = resultado
        r.set(f"tarea:{tarea['id']}", json.dumps(tarea))

if __name__ == "__main__":
    main()
