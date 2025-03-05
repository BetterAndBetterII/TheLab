import json
from typing import Any

from fastapi import FastAPI, Request

app = FastAPI()


@app.post("/v1/chat/completions")
async def chat_completions(request: Request) -> Any:
    # 打印所有请求头
    print("\n=== Headers ===")
    for header_name, header_value in request.headers.items():
        print(f"{header_name}: {header_value}")

    # 打印请求体
    body = await request.json()
    print("\n=== Request Body ===")
    print(json.dumps(body, ensure_ascii=False, indent=2))

    # 返回空响应
    return {"status": "ok"}


@app.get("/v1")
async def chat_completions(request: Request) -> Any:
    # 打印所有请求头
    print("\n=== Headers ===")
    for header_name, header_value in request.headers.items():
        print(f"{header_name}: {header_value}")

    # 打印请求体
    body = await request.json()
    print("\n=== Request Body ===")
    print(json.dumps(body, ensure_ascii=False, indent=2))

    # 返回空响应
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
