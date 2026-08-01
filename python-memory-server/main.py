from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import json

app = FastAPI()

class MineRequest(BaseModel):
    text: str
    wing: str = "default"
    mode: str = "project"

class SearchRequest(BaseModel):
    query: str
    wing: str = "default"

@app.post("/mine")
def mine_memory(req: MineRequest):
    # write to a temporary file
    import tempfile
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        f.write(req.text)
        temp_path = f.name
    
    cmd = ["mempalace", "mine", temp_path, "--wing", req.wing, "--mode", req.mode]
    res = subprocess.run(cmd, capture_output=True, text=True)
    
    import os
    os.remove(temp_path)

    if res.returncode != 0:
        raise HTTPException(status_code=500, detail=res.stderr)
    return {"status": "success", "output": res.stdout}

@app.post("/search")
def search_memory(req: SearchRequest):
    cmd = ["mempalace", "search", req.query, "--wing", req.wing, "--json"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise HTTPException(status_code=500, detail=res.stderr)
    
    try:
        results = json.loads(res.stdout)
    except json.JSONDecodeError:
        results = {"raw": res.stdout}
    return {"results": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
