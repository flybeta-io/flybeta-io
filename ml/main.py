from fastapi import FastAPI
import uvicorn
import os
from dotenv import load_dotenv
from src.router import router


load_dotenv()
PORT = int(os.getenv("ML_PORT", 7500))


app = FastAPI()
app.include_router(router)


if __name__ == "__main__":
    print(f"Server is running on port {PORT}")
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
