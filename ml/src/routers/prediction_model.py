from fastapi import APIRouter
import joblib  # type: ignore
import numpy as np
from src.schemas.prediction import PredictionRequest


stage_1_model = joblib.load("src/models/stage_1.joblib")
stage_2_model = joblib.load("src/models/stage_2.joblib")


router = APIRouter()


@router.get("/")
async def home():
    return "Welcome to FlyBeta ML API"


@router.post("/stage1")
async def predict(payload: PredictionRequest):
    # Convert Pydantic model → dict
    features = payload.model_dump()

    # Convert dict → list/array in same order as training
    X = [list(features.values())]

    # Make prediction
    prediction = stage_1_model.predict(X).item()

    return {"prediction": prediction}


@router.post("/stage2")
async def predict_stage_2(payload: PredictionRequest):

    features = payload.model_dump()

    X = [list(features.values())]


    prediction_2 = stage_2_model.predict(X).item()

    return {"prediction_2": prediction_2}
