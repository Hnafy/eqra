from typing import Any, Dict, List

import requests

from app.config import settings


class YouTubeService:
    """Searches YouTube videos through the YouTube Data API v3."""

    def search(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        if not settings.YOUTUBE_API_KEY:
            raise RuntimeError("YouTube API key is not configured (API_KEY)")

        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": max_results,
            "key": settings.YOUTUBE_API_KEY,
        }

        response = requests.get(
            settings.YOUTUBE_SEARCH_URL,
            params=params,
            timeout=settings.YOUTUBE_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        return [self._map_item(item) for item in data.get("items", [])]

    @staticmethod
    def _map_item(item: Dict[str, Any]) -> Dict[str, Any]:
        snippet = item.get("snippet", {})
        video_id = item.get("id", {}).get("videoId")
        thumbnails = snippet.get("thumbnails", {})
        thumbnail = (
            thumbnails.get("high")
            or thumbnails.get("medium")
            or thumbnails.get("default")
            or {}
        ).get("url")

        return {
            "video_id": video_id,
            "title": snippet.get("title"),
            "description": snippet.get("description"),
            "channel_title": snippet.get("channelTitle"),
            "published_at": snippet.get("publishedAt"),
            "thumbnail": thumbnail,
            "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
        }
