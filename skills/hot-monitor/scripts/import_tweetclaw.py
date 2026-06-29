#!/usr/bin/env python3
"""
Import TweetClaw or OpenClaw X/Twitter export JSON into the Hot Monitor result schema.

Usage:
    python import_tweetclaw.py --file tweetclaw-results.json
    cat tweetclaw-results.json | python import_tweetclaw.py --limit 20
"""

import argparse
import json
import sys


ARRAY_KEYS = ("results", "tweets", "items", "data", "records")
TEXT_KEYS = ("text", "content", "fullText", "tweetText", "body")
TIME_KEYS = ("publishedAt", "createdAt", "created_at", "timestamp", "time")


def first_value(item, keys, default=""):
    for key in keys:
        value = item.get(key)
        if value not in (None, ""):
            return value
    return default


def as_int(value):
    if value in (None, ""):
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def extract_rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ARRAY_KEYS:
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def extract_author(tweet):
    author = tweet.get("author") or tweet.get("user") or {}
    if not isinstance(author, dict):
        return {}
    username = first_value(author, ("username", "userName", "screenName", "handle"))
    return {
        "name": first_value(author, ("name", "displayName", "fullName")),
        "username": str(username).lstrip("@"),
        "avatar": first_value(author, ("avatar", "profileImageUrl", "profilePicture")),
        "followers": as_int(first_value(author, ("followers", "followersCount"))),
        "verified": bool(author.get("verified") or author.get("isBlueVerified")),
    }


def metric(tweet, name):
    metrics = tweet.get("metrics") or tweet.get("publicMetrics") or {}
    if not isinstance(metrics, dict):
        metrics = {}
    return as_int(tweet.get(name) or metrics.get(name))


def tweet_url(tweet, author):
    direct = first_value(tweet, ("url", "tweetUrl", "link"))
    if direct:
        return direct
    tweet_id = first_value(tweet, ("id", "tweetId", "sourceId"))
    username = author.get("username")
    if tweet_id and username:
        return f"https://x.com/{username}/status/{tweet_id}"
    return ""


def normalize_tweet(tweet):
    if not isinstance(tweet, dict):
        return None
    content = str(first_value(tweet, TEXT_KEYS)).strip()
    if not content:
        return None
    author = extract_author(tweet)
    return {
        "title": content[:100],
        "content": content,
        "url": tweet_url(tweet, author),
        "source": "tweetclaw",
        "sourceId": first_value(tweet, ("id", "tweetId", "sourceId")),
        "publishedAt": first_value(tweet, TIME_KEYS),
        "viewCount": metric(tweet, "viewCount"),
        "likeCount": metric(tweet, "likeCount"),
        "retweetCount": metric(tweet, "retweetCount"),
        "replyCount": metric(tweet, "replyCount"),
        "quoteCount": metric(tweet, "quoteCount"),
        "author": author,
    }


def load_payload(file_name):
    if file_name:
        with open(file_name, "r", encoding="utf-8") as handle:
            return json.load(handle)
    return json.load(sys.stdin)


def main():
    parser = argparse.ArgumentParser(description="Import TweetClaw export JSON")
    parser.add_argument("--file", help="Path to a TweetClaw JSON export")
    parser.add_argument("--limit", type=int, default=50, help="Max results (default: 50)")
    args = parser.parse_args()

    payload = load_payload(args.file)
    results = []
    for row in extract_rows(payload):
        normalized = normalize_tweet(row)
        if normalized:
            results.append(normalized)
        if len(results) >= args.limit:
            break

    json.dump(results, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
