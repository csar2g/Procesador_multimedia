import boto3
import os

s3 = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'us-east-1'))

BUCKET = os.getenv('AWS_BUCKET_NAME')

def subir_archivo(ruta_local: str, nombre_s3: str) -> str:
    s3.upload_file(ruta_local, BUCKET, nombre_s3)
    url = f"https://{BUCKET}.s3.amazonaws.com/{nombre_s3}"
    return url

def descargar_archivo(nombre_s3: str, ruta_local: str):
    s3.download_file(BUCKET, nombre_s3, ruta_local)
