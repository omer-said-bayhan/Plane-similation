import asyncio
import websockets
try:
    from websockets.http11 import Response
except ImportError:
    from websockets.server import Response

async def process_request(connection, request):
    return Response(200, "OK", [("Content-Type", "text/plain")], b"Hello")

async def handler(websocket):
    pass

async def main():
    try:
        async with websockets.serve(handler, "localhost", 8001, process_request=process_request):
            print("Server started on 8001")
            await asyncio.sleep(1)
            print("Server test successful")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
