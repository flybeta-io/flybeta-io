from fastapi import APIRouter

from src.routers.prediction_model import router as prediction_router

router = APIRouter()
router.include_router(prediction_router, prefix="/predict")
