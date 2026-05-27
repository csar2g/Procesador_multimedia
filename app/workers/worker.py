from PIL import Image
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

    print(f"Imagen guardada en {ruta_salida}")
    return ruta_salida

def procesar_youtube(tarea: dict):
    import yt_dlp

    payload = tarea["payload"]
    url = payload["url"]
    formato = payload["formato"]

    output_template = os.path.join(OUTPUT_DIR, f"{tarea['id']}.%(ext)s")

    ydl_opts = {
        "outtmpl": output_template,
        "quiet": True,
        "extractor_args": {"youtube": {"js_runtimes": ["node:/home/Cesar/.nvm/versions/node/v24.11.1/bin/node"]}},
        "remote_components": "ejs:github",
    }

    if formato == "mp3":
        ydl_opts["format"] = "bestaudio/best"
        ydl_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
        }]
    else:
        ydl_opts["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]"

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
