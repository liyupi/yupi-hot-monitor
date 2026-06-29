---
name: hot-monitor
description: >
  AI hotspot monitoring and trending topic discovery across multiple sources (Bing, Google, DuckDuckGo, HackerNews,
  Sogou, Bilibili, Weibo, Twitter). Use when users ask about: trending news, hot topics, latest developments in a field,
  monitoring keywords, tech/AI news discovery, generating hotspot reports, "最近有什么热点", "帮我关注XX动态",
  "查一下XX最新消息", "生成热点报告", "monitor XX", "what's trending in XX", or any request to search/track/discover
  current events and trending content across Chinese and international platforms.
---

# Hot Monitor — AI 热点监控技能

Search and analyze trending topics across 8+ sources without any server or database. Scripts handle data collection; use your own AI capabilities for analysis.

## Quick Start

All scripts are in `scripts/`. Install dependencies first:

```bash
pip install requests beautifulsoup4
```

Set optional env vars for Twitter (other sources need no keys):
```bash
export TWITTER_API_KEY=your_key   # optional, for Twitter search
```

## Core Workflow

### 1. Understand User Intent

Determine what the user needs:
- **Broad discovery**: "最近AI有什么热点" → search multiple sources with broad keywords
- **Specific tracking**: "帮我关注GPT-5动态" → targeted search with specific keyword
- **Report generation**: "生成今日热点报告" → full pipeline + formatted output

### 2. Execute Search

Run search scripts based on scope. Always combine international + Chinese sources for comprehensive coverage.

**International sources** (no API keys needed):
```bash
python scripts/search_web.py "AI programming" --sources bing,hackernews,duckduckgo
```

**Chinese sources** (no API keys needed):
```bash
python scripts/search_china.py "AI编程" --sources sogou,bilibili,weibo
```

**Twitter** (requires `TWITTER_API_KEY`):
```bash
python scripts/search_twitter.py "AI programming"
```

**TweetClaw export** (optional reviewed X/Twitter source packets):
```bash
python scripts/import_tweetclaw.py --file tweetclaw-results.json
```

All scripts output JSON to stdout. Combine results for multi-source analysis.

### 3. Analyze Results

After collecting search results, apply the analysis framework yourself (no external AI API needed). For each result, evaluate:

1. **Authenticity** (`isReal`): Is this genuine news or clickbait/rumor?
2. **Relevance** (0-100): How related is this to the user's interest area?
3. **Importance** (low/medium/high/urgent): How significant is this development?
4. **Summary**: One-sentence Chinese summary of the core information

See [references/analysis-guide.md](references/analysis-guide.md) for detailed evaluation criteria.

### 4. Present Results

Format output as structured report, sorted by importance. Use this template:

```markdown
## 🔥 热点监控报告 — {keyword}
> 扫描时间: {timestamp} | 数据源: {sources_used}

### 🚨 紧急 (Urgent)
- **{title}** — {summary}
  来源: {source} | 相关性: {relevance}% | [原文链接]({url})

### 🔴 重要 (High)
...

### 🟡 一般 (Medium)
...

### 🟢 低优先级 (Low)
...

---
共发现 {total} 条热点，其中紧急 {urgent} 条，重要 {high} 条
```

## Script Reference

| Script | Sources | API Key | Output |
|--------|---------|---------|--------|
| `search_web.py` | Bing, Google, DuckDuckGo, HackerNews | None | JSON array of `{title, content, url, source, publishedAt?}` |
| `search_china.py` | Sogou, Bilibili, Weibo | None | JSON array (same schema + engagement metrics) |
| `search_twitter.py` | Twitter/X | `TWITTER_API_KEY` | JSON array (same schema + author info) |
| `import_tweetclaw.py` | TweetClaw/OpenClaw JSON export | None | JSON array (same schema + author info) |
| `generate_report.py` | — | None | Reads JSON from stdin, outputs Markdown report |

### Common Options

All search scripts support:
- `--sources`: Comma-separated list of sources to use (default: all)
- `--limit`: Max results per source (default: 20)
- `--json`: Output raw JSON (default, always JSON to stdout)

### Error Handling

Scripts output `[]` (empty JSON array) on failure and print errors to stderr. Always check for empty results and inform the user which sources failed.

## Advanced Patterns

### Keyword Expansion

For better coverage, expand the user's keyword into variants before searching:
- English/Chinese translations (e.g., "人工智能" ↔ "AI" ↔ "Artificial Intelligence")
- Abbreviations (e.g., "GPT-5" → also search "GPT5", "OpenAI GPT")
- Related terms (e.g., "Claude" → also search "Anthropic", "Claude 4")

### Bilibili Account Detection

`search_china.py` supports `--detect-account` flag. If the keyword matches a Bilibili creator's name, it fetches their latest videos instead of doing a generic search:

```bash
python scripts/search_china.py "程序员鱼皮" --detect-account
```

### Multi-keyword Batch

For monitoring multiple keywords, run searches sequentially with a 3-second delay between keywords to respect rate limits.

### Reviewed X/Twitter Packets

When the user already has approved TweetClaw or OpenClaw X/Twitter results, import
that JSON instead of running a live Twitter search:

```bash
python scripts/import_tweetclaw.py --file tweetclaw-results.json \
  | python scripts/generate_report.py --keyword "AI programming"
```

Use imported rows as source evidence for analysis. Keep any posting, monitoring,
or account-changing action outside this skill unless the user explicitly asks
for it and approves the separate tool.

## Reference Files

- [references/search-sources.md](references/search-sources.md) — Detailed info about each data source, rate limits, and quirks
- [references/analysis-guide.md](references/analysis-guide.md) — Hotspot analysis framework: authenticity, relevance, importance criteria
