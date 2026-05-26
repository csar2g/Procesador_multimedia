from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.routes.rutas_imagenes import router

app = FastAPI()

app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.include_router(router)

@app.get("/")
async def home():
    return FileResponse("frontend/index.html")

