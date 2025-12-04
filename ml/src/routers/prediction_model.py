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


async def predict_stage_2(input):
    prediction_2 = stage_2_model.predict(input).item()
    return prediction_2


@router.post("/")
async def predict(payload: PredictionRequest):
    # Convert Pydantic model → dict
    features = payload.model_dump()

    # Convert dict → list/array in same order as training
    X = [list(features.values())]

    # Make prediction
    prediction = stage_1_model.predict(X).item()

    if prediction == 0:
        delay = "No delay!"
    else:
        prediction_2 = await predict_stage_2(X)

        if prediction_2 == 1:
            delay = "Greater than 30 mins"
        else:
            delay = "Less than 30 mins"

    return {"Delay": delay}
