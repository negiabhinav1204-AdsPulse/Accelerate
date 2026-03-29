"""Web scraper — Crawl4AI browser automation + platform-specific extractors.

Ported from accelerate-agentic-framework/v2/tools/scraper/.

Routing:
- Amazon URLs → HTTP-based fetch + regex extraction (Amazon blocks headless browsers)
- Everything else → Crawl4AI browser crawl + optional Shopify JSON API fetch
"""

from __future__ import annotations

import asyncio
import html as html_mod
import logging
import re
from typing import Any, Dict, List, Literal, Optional, Tuple
from urllib.parse import urlparse

import httpx

from src.agentic_platform.app.campaigns.models import (
    GenericProductData,
    PageMetadata,
    ShopifyImage,
    ShopifyProductData,
    ShopifyVariant,
    WebsiteContent,
)

logger = logging.getLogger(__name__)

# ── Config defaults ───────────────────────────────────────────────

MAX_MARKDOWN_LENGTH = 50_000
MAX_TEXT_LENGTH = 30_000
PAGE_TIMEOUT = 30_000  # ms
BROWSER_TYPE = "chromium"


# ── HTML utilities (pure functions) ───────────────────────────────

class _Patterns:
    THEME_COLOR = re.compile(
        r'<meta[^>]+name=["\']theme-color["\'][^>]+content=["\'](#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))["\']', re.I)
    THEME_COLOR_ALT = re.compile(
        r'<meta[^>]+content=["\'](#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))["\'][^>]+name=["\']theme-color["\']', re.I)
    CSS_COLOR_VAR = re.compile(
        r'--(primary|brand|accent|main|theme|secondary)[-\w]*\s*:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))', re.I)
    OG_IMAGE = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', re.I)
    OG_IMAGE_ALT = re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', re.I)
    FAVICON = re.compile(r'<link[^>]+rel=["\'](?:shortcut )?icon["\'][^>]+href=["\']([^"\']+)["\']', re.I)
    FAVICON_ALT = re.compile(r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\'](?:shortcut )?icon["\']', re.I)
    APPLE_TOUCH_ICON = re.compile(
        r'<link[^>]+rel=["\']apple-touch-icon(?:-precomposed)?["\'][^>]+href=["\']([^"\']+)["\']', re.I)
    APPLE_TOUCH_ICON_ALT = re.compile(
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']apple-touch-icon(?:-precomposed)?["\']', re.I)
    META_DESCRIPTION = re.compile(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)', re.I)
    PRODUCT_PATH = re.compile(r'/(?:product|item|p|dp|shop)/|/(?:products|items)/[^/]+$', re.I)
    CATEGORY_PATH = re.compile(r'/(?:category|collection|collections|catalog|shop|c|browse)(?:/|$)', re.I)
    SHOPIFY_HTML = re.compile(r'cdn\.shopify\.com|Shopify\.shop|shopify-checkout-api-token', re.I)


def _first_group(patterns, text: str) -> Optional[str]:
    for pat in patterns:
        m = pat.search(text)
        if m:
            return m.group(1)
    return None


def extract_theme_color(html: str) -> Optional[str]:
    return _first_group((_Patterns.THEME_COLOR, _Patterns.THEME_COLOR_ALT), html)


def extract_brand_colors(html: str, max_colors: int = 6) -> List[str]:
    seen: set[str] = set()
    colors: List[str] = []
    for match in _Patterns.CSS_COLOR_VAR.finditer(html):
        color = match.group(2).strip()
        if color.lower() not in seen:
            seen.add(color.lower())
            colors.append(color)
            if len(colors) >= max_colors:
                break
    return colors


def extract_og_image(html: str) -> Optional[str]:
    return _first_group((_Patterns.OG_IMAGE, _Patterns.OG_IMAGE_ALT), html)


_RASTER_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".gif", ".webp"})
_NON_RASTER_EXTENSIONS = frozenset({".svg", ".ico"})


def _normalise_href(href: str, base_url: str) -> str:
    if href.startswith("http"):
        return href
    parsed = urlparse(base_url)
    if href.startswith("//"):
        return f"{parsed.scheme}:{href}"
    return f"{parsed.scheme}://{parsed.netloc}{href}"


def _href_extension(href: str) -> str:
    path = href.lower().split("?")[0].split("#")[0]
    dot = path.rfind(".")
    return path[dot:] if dot != -1 else ""


def extract_favicon(html: str, base_url: str) -> Optional[str]:
    seen: set[str] = set()
    candidates: list[tuple[int, str]] = []
    for pat in (_Patterns.APPLE_TOUCH_ICON, _Patterns.APPLE_TOUCH_ICON_ALT):
        for m in pat.finditer(html):
            href = m.group(1)
            if href not in seen:
                seen.add(href)
                candidates.append((0, href))
    for pat in (_Patterns.FAVICON, _Patterns.FAVICON_ALT):
        for m in pat.finditer(html):
            href = m.group(1)
            if href not in seen:
                seen.add(href)
                ext = _href_extension(href)
                if ext in _RASTER_EXTENSIONS:
                    candidates.append((1, href))
                elif ext in _NON_RASTER_EXTENSIONS:
                    candidates.append((3, href))
                else:
                    candidates.append((2, href))
    if not candidates:
        return None
    candidates.sort(key=lambda c: c[0])
    return _normalise_href(candidates[0][1], base_url)


def extract_meta_description(html: str) -> str:
    m = _Patterns.META_DESCRIPTION.search(html)
    return m.group(1) if m else ""


_PRODUCT_SIGNALS = ("add to cart", "buy now", "add to bag", "add to wishlist", "product description", "sku", "quantity")
_CATEGORY_SIGNALS = ("sort by", "filter", "view all")


def detect_page_type(url: str, title: str, markdown: str) -> Literal["homepage", "product", "category", "other"]:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    if not path:
        return "homepage"
    if _Patterns.PRODUCT_PATH.search(path):
        return "product"
    if _Patterns.CATEGORY_PATH.search(path):
        return "category"
    lower_md = markdown[:3000].lower()
    product_hits = sum(kw in lower_md for kw in _PRODUCT_SIGNALS)
    if product_hits >= 2:
        return "product"
    category_hits = sum(kw in lower_md for kw in _CATEGORY_SIGNALS)
    if category_hits >= 2:
        return "category"
    segments = [s for s in path.split("/") if s]
    if len(segments) >= 2 and product_hits >= 1:
        return "product"
    return "other"


def detect_shopify(html: str) -> bool:
    return bool(_Patterns.SHOPIFY_HTML.search(html))


# ── Amazon extractor ──────────────────────────────────────────────

_DOMAIN_CURRENCY: Dict[str, str] = {
    "amazon.in": "INR", "amazon.co.uk": "GBP", "amazon.de": "EUR",
    "amazon.fr": "EUR", "amazon.it": "EUR", "amazon.es": "EUR",
    "amazon.ca": "CAD", "amazon.com.au": "AUD", "amazon.co.jp": "JPY",
}

AMAZON_HEADERS: Dict[str, str] = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}


def is_amazon_url(url: str) -> bool:
    domain = urlparse(url).netloc.lower()
    return "amazon." in domain or domain.endswith("amazon.com")


def _detect_amazon_currency(url: str) -> str:
    domain = urlparse(url).netloc.lower()
    for suffix, currency in _DOMAIN_CURRENCY.items():
        if suffix in domain:
            return currency
    return "USD"


class _AmazonExtractor:
    _RE_TITLE = re.compile(r'id="productTitle"[^>]*>\s*([^<]+)\s*<', re.I)
    _RE_BRAND = (
        re.compile(r'id="bylineInfo"[^>]*>.*?Visit the ([^<]+) Store', re.DOTALL | re.I),
        re.compile(r'id="bylineInfo"[^>]*>.*?Brand:\s*</[^>]+>\s*<[^>]+>([^<]+)', re.DOTALL | re.I),
        re.compile(r'id="bylineInfo"[^>]*href="[^"]*"[^>]*>([^<]+)<', re.I),
    )
    _RE_PRICE = re.compile(r'class="a-price-whole">([0-9,]+)', re.I)
    _RE_MRP = (
        re.compile(r'class="a-text-price"[^>]*data-a-strike="true"[^>]*>\s*<span[^>]*>₹([0-9,]+)', re.I),
        re.compile(r'M\.R\.P\.:\s*</span>\s*<span[^>]*>₹([0-9,]+)', re.I),
    )
    _RE_RATING = re.compile(r'<span[^>]+class="a-icon-alt"[^>]*>([0-9.]+) out of', re.I)
    _RE_FEATURE = re.compile(r'<li[^>]*><span[^>]+class="a-list-item"[^>]*>\s*([^<]+)\s*</span></li>', re.I)
    _RE_DESCRIPTION = re.compile(r'id="productDescription"[^>]*>.*?<p[^>]*>([^<]+)', re.DOTALL | re.I)
    _RE_ASIN = re.compile(r'/dp/([A-Z0-9]{10})')
    _RE_MAIN_IMAGE = re.compile(r'id="landingImage"[^>]+(?:src|data-old-hires)="([^"]+)"', re.I)
    _RE_PRODUCT_IMAGE = re.compile(r'(https://m\.media-amazon\.com/images/I/[A-Za-z0-9]+[^"\'<>\s]*\.(?:jpg|png|webp))')
    _RE_IMAGE_SIZE = re.compile(r'\._[A-Z0-9_,]+_\.')
    _RE_IMAGE_ID = re.compile(r'/images/I/([A-Za-z0-9]+)')

    @classmethod
    def extract(cls, html: str, url: str) -> Optional[GenericProductData]:
        title_m = cls._RE_TITLE.search(html)
        if not title_m:
            return None
        title = html_mod.unescape(title_m.group(1).strip())

        def _first(patterns):
            for pat in patterns:
                m = pat.search(html)
                if m:
                    return html_mod.unescape(m.group(1).strip())
            return None

        images = cls._extract_images(html)
        features = [html_mod.unescape(m.group(1).strip()) for m in cls._RE_FEATURE.finditer(html)
                     if len(m.group(1).strip()) >= 20][:10]
        desc_m = cls._RE_DESCRIPTION.search(html)

        return GenericProductData(
            title=title,
            brand=_first(cls._RE_BRAND),
            price=cls._RE_PRICE.search(html).group(1) if cls._RE_PRICE.search(html) else None,
            currency=_detect_amazon_currency(url),
            original_price=_first(cls._RE_MRP),
            rating=cls._RE_RATING.search(html).group(1) if cls._RE_RATING.search(html) else None,
            images=images,
            features=features,
            description=html_mod.unescape(desc_m.group(1).strip()) if desc_m else None,
            asin=cls._RE_ASIN.search(url).group(1) if cls._RE_ASIN.search(url) else None,
            product_url=url,
            platform="amazon",
        )

    @classmethod
    def _extract_images(cls, html: str) -> List[str]:
        seen: set[str] = set()
        images: List[str] = []
        main_m = cls._RE_MAIN_IMAGE.search(html)
        if main_m:
            cleaned = cls._RE_IMAGE_SIZE.sub("._AC_SL1500_.", main_m.group(1))
            img_id_m = cls._RE_IMAGE_ID.search(cleaned)
            if img_id_m:
                seen.add(img_id_m.group(1))
                images.append(cleaned)
        for raw in cls._RE_PRODUCT_IMAGE.findall(html):
            if len(images) >= 10:
                break
            cleaned = cls._RE_IMAGE_SIZE.sub("._AC_SL1500_.", raw)
            img_id_m = cls._RE_IMAGE_ID.search(cleaned)
            if img_id_m and img_id_m.group(1) not in seen:
                seen.add(img_id_m.group(1))
                images.append(cleaned)
        return images


def _build_amazon_markdown(product: GenericProductData) -> str:
    parts = [f"# {product.title}\n"]
    if product.brand:
        parts.append(f"**Brand:** {product.brand}\n")
    if product.price:
        parts.append(f"**Price:** {product.formatted_price}\n")
    if product.features:
        parts.append("\n## Features\n")
        parts.extend(f"- {f}\n" for f in product.features)
    return "".join(parts)


# ── Shopify extractor ─────────────────────────────────────────────

async def _fetch_shopify_product(url: str) -> Optional[ShopifyProductData]:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    if "/products/" not in path:
        return None

    base_url = f"{parsed.scheme}://{parsed.netloc}{path}"
    json_urls = [f"{base_url}.json", f"{base_url}.js"]

    async def _try_fetch(json_url: str) -> Optional[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
                resp = await client.get(json_url)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("product"):
                        return data
        except Exception:
            pass
        return None

    results = await asyncio.gather(*[_try_fetch(u) for u in json_urls])
    for data in results:
        if data and data.get("product"):
            return _parse_shopify_product(data["product"], url)
    return None


def _parse_shopify_product(data: Dict[str, Any], original_url: str) -> ShopifyProductData:
    first_variant = (data.get("variants") or [{}])[0] if data.get("variants") else {}
    parsed = urlparse(original_url)
    handle = data.get("handle", "")
    product_url = f"{parsed.scheme}://{parsed.netloc}/products/{handle}" if handle else original_url

    images = [ShopifyImage(src=img.get("src", ""), position=img.get("position", 1),
                           width=img.get("width"), height=img.get("height"), alt=img.get("alt"))
              for img in data.get("images", [])]

    feat = data.get("image")
    featured_image = ShopifyImage(src=feat.get("src", ""), position=feat.get("position", 1),
                                  width=feat.get("width"), height=feat.get("height"),
                                  alt=feat.get("alt")) if isinstance(feat, dict) else None

    variants = [ShopifyVariant(
        title=v.get("title", "Default"), price=v.get("price", "0.00"),
        compare_at_price=v.get("compare_at_price"), sku=v.get("sku"),
        available=v.get("available", True), option1=v.get("option1"),
        option2=v.get("option2"), option3=v.get("option3"),
    ) for v in data.get("variants", [])]

    tags_raw = data.get("tags", "")
    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if isinstance(tags_raw, str) else (tags_raw if isinstance(tags_raw, list) else [])

    return ShopifyProductData(
        product_id=data.get("id", 0), title=data.get("title", ""), handle=handle,
        description_html=data.get("body_html", ""), vendor=data.get("vendor", ""),
        product_type=data.get("product_type", ""), tags=tags,
        price=first_variant.get("price", "0.00"),
        compare_at_price=first_variant.get("compare_at_price"),
        currency=first_variant.get("price_currency", "INR"),
        images=images, featured_image=featured_image, variants=variants,
        options=data.get("options", []), product_url=product_url,
        created_at=data.get("created_at"), updated_at=data.get("updated_at"),
        published_at=data.get("published_at"),
    )


# ── Crawl4AI result helpers ───────────────────────────────────────

def _extract_markdown(result: Any) -> str:
    if not hasattr(result, "markdown"):
        return ""
    if hasattr(result.markdown, "raw_markdown"):
        return result.markdown.raw_markdown or ""
    if isinstance(result.markdown, str):
        return result.markdown
    return ""


def _extract_title_description(result: Any) -> Tuple[str, str]:
    if not hasattr(result, "metadata") or not result.metadata:
        return "", ""
    return result.metadata.get("title") or "", result.metadata.get("description") or ""


# ── Main scraper ──────────────────────────────────────────────────

async def scrape_website(url: str) -> WebsiteContent:
    """Scrape a website and return structured content."""
    if is_amazon_url(url):
        return await _scrape_amazon(url)
    try:
        return await _scrape_with_browser(url)
    except Exception as exc:
        logger.warning("Browser scrape failed (%s), falling back to httpx: %s", type(exc).__name__, exc)
        return await _scrape_with_httpx(url)


async def _scrape_with_httpx(url: str) -> WebsiteContent:
    """Lightweight fallback scraper using plain httpx — no browser needed."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            })
            if resp.status_code != 200:
                return WebsiteContent(url=url, is_successful=False, error_message=f"HTTP {resp.status_code}")
            raw_html = resp.text

        title = ""
        title_m = re.search(r'<title[^>]*>([^<]+)</title>', raw_html, re.I)
        if title_m:
            title = title_m.group(1).strip()

        description = extract_meta_description(raw_html)
        page_type = detect_page_type(url, title, raw_html[:3000])
        is_shopify = detect_shopify(raw_html)

        metadata = PageMetadata(
            title=title,
            description=description,
            status_code=resp.status_code,
            favicon_url=extract_favicon(raw_html, url),
            og_image=extract_og_image(raw_html),
            theme_color=extract_theme_color(raw_html),
            brand_colors=extract_brand_colors(raw_html),
            page_type=page_type,
            is_shopify=is_shopify,
        )

        markdown = f"# {title}\n\n{description}\n" if title else ""

        shopify_product = None
        if is_shopify and page_type == "product":
            shopify_product = await _fetch_shopify_product(url)

        return WebsiteContent(
            url=url,
            markdown=markdown[:MAX_MARKDOWN_LENGTH],
            text=markdown[:MAX_TEXT_LENGTH],
            metadata=metadata,
            shopify_product=shopify_product,
            is_successful=True,
        )
    except Exception as exc:
        logger.exception("httpx fallback scrape failed for %s", url)
        return WebsiteContent(url=url, is_successful=False, error_message=str(exc))


async def _scrape_amazon(url: str) -> WebsiteContent:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(url, headers=AMAZON_HEADERS)
            if resp.status_code != 200:
                return WebsiteContent(url=url, is_successful=False, error_message=f"HTTP {resp.status_code}")
            raw_html = resp.text

        product = _AmazonExtractor.extract(raw_html, url)
        page_type: Literal["homepage", "product", "category", "other"] = "product" if product else "other"
        metadata = PageMetadata(
            title=product.title if product else "",
            description=extract_meta_description(raw_html),
            status_code=200,
            favicon_url=extract_favicon(raw_html, url),
            og_image=extract_og_image(raw_html),
            theme_color=extract_theme_color(raw_html),
            brand_colors=extract_brand_colors(raw_html),
            page_type=page_type,
            is_shopify=False,
        )
        markdown = _build_amazon_markdown(product) if product else ""
        return WebsiteContent(
            url=url, markdown=markdown[:MAX_MARKDOWN_LENGTH], text=markdown[:MAX_TEXT_LENGTH],
            metadata=metadata, generic_product=product, is_successful=True,
        )
    except Exception as exc:
        logger.exception("Error scraping Amazon URL %s", url)
        return WebsiteContent(url=url, is_successful=False, error_message=str(exc))


async def _scrape_with_browser(url: str) -> WebsiteContent:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

    browser_config = BrowserConfig(browser_type=BROWSER_TYPE, headless=True, verbose=False)
    crawl_config = CrawlerRunConfig(
        wait_until="domcontentloaded",
        page_timeout=PAGE_TIMEOUT,
        cache_mode=CacheMode.BYPASS,
        excluded_tags=["script", "style", "nav", "footer", "header"],
        magic=True,
        simulate_user=True,
    )

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=url, config=crawl_config)

            if not result.success:
                return WebsiteContent(
                    url=url, is_successful=False,
                    error_message=result.error_message or "Crawl failed",
                )

            markdown = _extract_markdown(result)
            title, description = _extract_title_description(result)
            raw_html = getattr(result, "html", "") or ""

            page_type = detect_page_type(url, title, markdown)
            is_shopify = detect_shopify(raw_html)

            metadata = PageMetadata(
                title=title, description=description,
                status_code=getattr(result, "status_code", None) or 200,
                favicon_url=extract_favicon(raw_html, url),
                og_image=extract_og_image(raw_html),
                theme_color=extract_theme_color(raw_html),
                brand_colors=extract_brand_colors(raw_html),
                page_type=page_type,
                is_shopify=is_shopify,
            )

            text = result.cleaned_html[:MAX_TEXT_LENGTH] if result.cleaned_html else ""

            shopify_product = None
            if is_shopify and page_type == "product":
                shopify_product = await _fetch_shopify_product(url)

            return WebsiteContent(
                url=url, markdown=markdown[:MAX_MARKDOWN_LENGTH], text=text,
                metadata=metadata, shopify_product=shopify_product, is_successful=True,
            )
    except Exception as exc:
        logger.exception("Error scraping URL %s", url)
        return WebsiteContent(url=url, is_successful=False, error_message=str(exc))
