from fastapi import APIRouter
from app.services.s3_client import s3, BUCKET

router = APIRouter()

@router.get("/s3/presigned-post")
async def generar_presigned_post(filename: str, content_type: str):
    try:
        response = s3.generate_presigned_post(
            Bucket=BUCKET,
            Key=f"uploads/{filename}",
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, 10 * 1024 * 1024]
            ],
            ExpiresIn=300  
        )
        return response
    except Exception as e:
        return {"error": str(e)}
