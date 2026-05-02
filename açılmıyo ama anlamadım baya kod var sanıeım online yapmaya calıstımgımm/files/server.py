import asyncio
import websockets
from websockets.datastructures import Headers
from websockets.http11 import Response
import json
import uuid
import os
import http

clients = {}

async def process_request(connection, request):
    if hasattr(request, "path"):
        req_path = request.path
    else:
        req_path = str(connection)
        
    if req_path == "/": req_path = "/index.html"
    filepath = req_path.lstrip("/")
    
    if os.path.exists(filepath) and os.path.isfile(filepath):
        with open(filepath, "rb") as f:
            content = f.read()
            
        if filepath.endswith(".html"): ct = "text/html"
        elif filepath.endswith(".js"): ct = "application/javascript"
        elif filepath.endswith(".css"): ct = "text/css"
        else: ct = "application/octet-stream"
        
        headers = Headers()
        headers["Content-Type"] = ct
        headers["Content-Length"] = str(len(content))
        headers["Access-Control-Allow-Origin"] = "*"
        
        return Response(200, "OK", headers, content)
    
    return None

async def handler(websocket):
    client_id = str(uuid.uuid4())
    clients[websocket] = {"id": client_id, "state": {}}
    print(f"Yeni oyuncu bağlandı: {client_id}")
    
    await websocket.send(json.dumps({"type": "init", "id": client_id}))
    
    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get("type")
            if msg_type == "update":
                clients[websocket]["state"] = data["state"]
                msg = json.dumps({"type": "state", "id": client_id, "state": data["state"]})
                for c in list(clients.keys()):
                    if c != websocket:
                        await c.send(msg)
            elif msg_type == "fire":
                msg = json.dumps({"type": "fire", "id": client_id})
                for c in list(clients.keys()):
                    if c != websocket:
                        await c.send(msg)
            elif msg_type == "die":
                msg = json.dumps({"type": "die", "id": client_id})
                for c in list(clients.keys()):
                    if c != websocket:
                        await c.send(msg)
    except:
        pass
    finally:
        if websocket in clients:
            del clients[websocket]
        msg = json.dumps({"type": "leave", "id": client_id})
        for c in list(clients.keys()):
            try: await c.send(msg)
            except: pass

async def start_ws_server():
    print("Oyun ve WebSocket 8000 portunda tek kanaldan çalışıyor...")
    async with websockets.serve(handler, "0.0.0.0", 8000, process_request=process_request):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(start_ws_server())
