"""Read-only anonymous upstream smoke probe. Run with PYTHONPATH=src.

Prints counts/status only; does not read credentials, persist data, or download
media files. Success is availability evidence, not browser playback or OAuth QA.
"""
import asyncio
import json

import httpx

from app.services import anilist, animethemes


async def reachable(url):
    if not url:
        return {"available": False}
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        async with client.stream("GET", url, headers={"Range": "bytes=0-1023"}) as response:
            response.raise_for_status()
            # Stop after the first chunk; never save a remote media file.
            async for chunk in response.aiter_bytes():
                return {"status": response.status_code, "type": response.headers.get("content-type"), "received_bytes": len(chunk)}
    return {"available": False}


async def main():
    report = {}
    try:
        matches = await anilist.search_media("Cowboy Bebop", limit=3)
        report["title_search"] = {"matches": len(matches)}
        details = await anilist.fetch_media_details(matches[0].id)
        report["evaluation_metadata"] = {"media_id": details.id, "genres": len(details.genres), "has_year": bool(details.seasonYear), "has_description": bool(details.description)}
        cover = details.coverImage
        report["poster"] = await reachable(cover.large or cover.extraLarge if cover else None)
        images = [e.node.image.large for e in details.characters.edges if e.node.image and e.node.image.large] if details.characters else []
        report["character_image"] = await reachable(images[0] if images else None)
    except Exception as error:
        report["anilist_error"] = type(error).__name__
    try:
        clip = await animethemes.find_opening_clip(["Cowboy Bebop"])
        report["opening_lookup"] = {"found": bool(clip)}
        if clip:
            report["opening_media"] = await reachable(clip.audio_url or clip.video_url)
    except Exception as error:
        report["animethemes_error"] = type(error).__name__
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
