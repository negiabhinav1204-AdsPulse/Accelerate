from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello, FastAPI running on Python 3.11 for Accelerate-Gen!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
