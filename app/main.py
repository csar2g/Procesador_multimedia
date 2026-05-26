from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.routes.rutas_imagenes import router
from app.routes.rutas_video import router as router_youtube

app = FastAPI()

app.include_router(router_youtube)
app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.include_router(router)

@app.get("/")
async def home():
    return FileResponse("frontend/index.html")

