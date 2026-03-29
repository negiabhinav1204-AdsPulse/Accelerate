"""Feed health scoring and Google Product Taxonomy mapping.

Used by the feeds router to assess product data quality for shopping feeds.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# ── Google Product Taxonomy Keyword Map ─────────────────────────────────────

CATEGORY_MAP: dict[str, str] = {
    "shoes": "Apparel & Accessories > Shoes",
    "sneakers": "Apparel & Accessories > Shoes > Athletic Shoes",
    "shirt": "Apparel & Accessories > Clothing > Shirts & Tops",
    "t-shirt": "Apparel & Accessories > Clothing > Shirts & Tops",
    "tshirt": "Apparel & Accessories > Clothing > Shirts & Tops",
    "pants": "Apparel & Accessories > Clothing > Pants",
    "shorts": "Apparel & Accessories > Clothing > Shorts",
    "dress": "Apparel & Accessories > Clothing > Dresses",
    "jacket": "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
    "coat": "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
    "hat": "Apparel & Accessories > Clothing Accessories > Hats",
    "cap": "Apparel & Accessories > Clothing Accessories > Hats",
    "bag": "Apparel & Accessories > Handbags, Wallets & Cases",
    "backpack": "Apparel & Accessories > Handbags, Wallets & Cases > Backpacks",
    "wallet": "Apparel & Accessories > Handbags, Wallets & Cases > Wallets",
    "watch": "Apparel & Accessories > Jewelry > Watches",
    "jewelry": "Apparel & Accessories > Jewelry",
    "necklace": "Apparel & Accessories > Jewelry > Necklaces",
    "bracelet": "Apparel & Accessories > Jewelry > Bracelets",
    "ring": "Apparel & Accessories > Jewelry > Rings",
    "sunglasses": "Apparel & Accessories > Clothing Accessories > Sunglasses",
    "electronics": "Electronics",
    "phone": "Electronics > Communications > Telephony > Mobile Phones",
    "smartphone": "Electronics > Communications > Telephony > Mobile Phones",
    "laptop": "Electronics > Computers > Laptops",
    "tablet": "Electronics > Computers > Tablet Computers",
    "headphones": "Electronics > Audio > Headphones & Earbuds",
    "earbuds": "Electronics > Audio > Headphones & Earbuds",
    "speaker": "Electronics > Audio > Speakers",
    "camera": "Electronics > Camera & Photo > Cameras",
    "charger": "Electronics > Electronics Accessories > Power > Chargers",
    "cable": "Electronics > Electronics Accessories > Cables",
    "supplement": "Health & Beauty > Health Care > Vitamins & Supplements",
    "vitamin": "Health & Beauty > Health Care > Vitamins & Supplements",
    "protein": "Health & Beauty > Health Care > Vitamins & Supplements > Protein Supplements",
    "skincare": "Health & Beauty > Personal Care > Cosmetics > Skin Care",
    "serum": "Health & Beauty > Personal Care > Cosmetics > Skin Care",
    "moisturizer": "Health & Beauty > Personal Care > Cosmetics > Skin Care",
    "beauty": "Health & Beauty > Personal Care > Cosmetics",
    "makeup": "Health & Beauty > Personal Care > Cosmetics",
    "perfume": "Health & Beauty > Personal Care > Fragrances",
    "shampoo": "Health & Beauty > Personal Care > Hair Care",
    "toy": "Toys & Games",
    "game": "Toys & Games > Games",
    "puzzle": "Toys & Games > Puzzles",
    "book": "Media > Books",
    "food": "Food, Beverages & Tobacco > Food Items",
    "snack": "Food, Beverages & Tobacco > Food Items > Snack Foods",
    "coffee": "Food, Beverages & Tobacco > Beverages > Coffee",
    "tea": "Food, Beverages & Tobacco > Beverages > Tea",
    "wine": "Food, Beverages & Tobacco > Beverages > Alcoholic Beverages > Wine",
    "beer": "Food, Beverages & Tobacco > Beverages > Alcoholic Beverages > Beer",
    "furniture": "Home & Garden > Furniture",
    "sofa": "Home & Garden > Furniture > Sofas & Sectionals",
    "chair": "Home & Garden > Furniture > Chairs",
    "desk": "Home & Garden > Furniture > Desks",
    "bed": "Home & Garden > Furniture > Beds & Bed Frames",
    "lamp": "Home & Garden > Lighting",
    "candle": "Home & Garden > Decor > Candles & Holders",
    "kitchen": "Home & Garden > Kitchen & Dining",
    "cookware": "Home & Garden > Kitchen & Dining > Cookware",
    "home": "Home & Garden",
    "garden": "Home & Garden > Lawn & Garden",
    "plant": "Home & Garden > Lawn & Garden > Plants",
    "pet": "Animals & Pet Supplies",
    "dog": "Animals & Pet Supplies > Pet Supplies > Dog Supplies",
    "cat": "Animals & Pet Supplies > Pet Supplies > Cat Supplies",
    "sports": "Sporting Goods",
    "fitness": "Sporting Goods > Exercise & Fitness",
    "yoga": "Sporting Goods > Exercise & Fitness > Yoga & Pilates",
    "pickleball": "Sporting Goods > Racquet Sports > Pickleball",
    "tennis": "Sporting Goods > Racquet Sports > Tennis",
    "golf": "Sporting Goods > Golf",
    "cycling": "Sporting Goods > Cycling",
    "bike": "Sporting Goods > Cycling > Bicycles",
    "swimming": "Sporting Goods > Water Sports > Swimming",
    "camping": "Sporting Goods > Outdoor Recreation > Camping & Hiking",
    "hiking": "Sporting Goods > Outdoor Recreation > Camping & Hiking",
    "automotive": "Vehicles & Parts > Vehicle Parts & Accessories",
    "car": "Vehicles & Parts > Vehicles > Motor Vehicles > Cars, Trucks & Vans",
    "baby": "Baby & Toddler",
    "diaper": "Baby & Toddler > Diapering",
    "office": "Office Supplies",
    "pen": "Office Supplies > Writing & Drawing Instruments > Pens",
    "notebook": "Office Supplies > Paper Products > Notebooks",
    "craft": "Arts & Entertainment > Crafts",
    "art": "Arts & Entertainment > Arts & Crafts Supplies",
    "paint": "Arts & Entertainment > Arts & Crafts Supplies > Art Paints",
}


def map_google_category(title: str, product_type: str = "", tags: str = "") -> str:
    """Best-effort Google Product Taxonomy mapping.

    Combines title, product_type, and tags into a searchable string and
    returns the first matching Google taxonomy string. Falls back to
    'Uncategorized > {product_type}' or 'Uncategorized' if no match.
    """
    combined = f"{title} {product_type} {tags}".lower()
    for keyword, category in CATEGORY_MAP.items():
        if keyword in combined:
            return category
    if product_type:
        return f"Uncategorized > {product_type}"
    return "Uncategorized"


# ── Per-Product Health Scoring ───────────────────────────────────────────────

def compute_product_health_score(product: dict) -> tuple[int, list[str]]:
    """Compute feed health score (0-100) and issues list for a normalized product dict.

    The product dict is expected to have keys from the internal Product table:
    imageUrl, description, price, googleCategory (or product_type), additionalImages,
    sku, barcode, title, and optionally tags.

    Score breakdown:
    - Has image: +20
    - Has description (>10 chars): +15
    - Has price > 0: +15
    - Has google_category: +15
    - Has multiple images or additional_images: +10
    - Has SKU/barcode: +10
    - Description length > 100 chars: +10
    - Title not generic (not 'product', 'untitled', etc), length > 5: +5

    Returns:
        (score, issues) where issues is a list of improvement suggestions.
    """
    score = 0
    issues: list[str] = []

    # --- Image: +20 ---
    image_url = product.get("imageUrl") or product.get("image_url") or ""
    if image_url:
        score += 20
    else:
        issues.append("No product image — add a high-quality image to improve CTR")

    # --- Description (>10 chars): +15 ---
    description = product.get("description") or ""
    desc_text = description.strip()
    if len(desc_text) > 10:
        score += 15
    else:
        issues.append("Missing or very short description — add a product description")

    # --- Price > 0: +15 ---
    try:
        price = float(product.get("price") or 0)
    except (TypeError, ValueError):
        price = 0.0
    if price > 0:
        score += 15
    else:
        issues.append("No price set — required for Google Shopping")

    # --- Has google_category / product_type: +15 ---
    google_category = (
        product.get("googleCategory")
        or product.get("google_category")
        or product.get("productType")
        or product.get("product_type")
        or ""
    )
    if google_category:
        score += 15
    else:
        issues.append("No product category — assign a Google product category for better targeting")

    # --- Multiple images or additional_images: +10 ---
    additional_images = product.get("additionalImages") or product.get("additional_images") or []
    if isinstance(additional_images, str):
        # May be stored as comma-separated string
        additional_images = [x.strip() for x in additional_images.split(",") if x.strip()]
    if len(additional_images) >= 1:
        score += 10
    else:
        issues.append("Only one image — add additional angles/views to increase conversion")

    # --- SKU or barcode: +10 ---
    sku = product.get("sku") or ""
    barcode = product.get("barcode") or ""
    if sku or barcode:
        score += 10
    else:
        issues.append("No SKU or barcode — add GTIN/SKU for better Google Shopping eligibility")

    # --- Description length > 100: +10 ---
    if len(desc_text) > 100:
        score += 10
    elif len(desc_text) > 10:
        issues.append("Description is short — aim for 100+ characters for better quality score")

    # --- Title not generic, length > 5: +5 ---
    title = (product.get("title") or "").strip()
    _generic_titles = {"product", "untitled", "test", "sample", "item", "new product", "new"}
    if title.lower() not in _generic_titles and len(title) > 5:
        score += 5
    else:
        issues.append("Title looks generic or too short — include brand, key features, and keywords")

    return score, issues


# ── Feed-Level Health Aggregation ───────────────────────────────────────────

def compute_feed_health(products: list[dict]) -> dict:
    """Aggregate feed health across all products.

    Returns:
        {
            avg_score: int,
            total_products: int,
            critical_issues: list[str],   # top issues by frequency
            distribution: {
                excellent: int,  # 80-100
                good: int,       # 60-79
                fair: int,       # 40-59
                poor: int,       # 0-39
            }
        }
    """
    if not products:
        return {
            "avg_score": 0,
            "total_products": 0,
            "critical_issues": [],
            "distribution": {"excellent": 0, "good": 0, "fair": 0, "poor": 0},
        }

    distribution = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
    issue_counts: dict[str, int] = {}
    total_score = 0

    for product in products:
        score, issues = compute_product_health_score(product)
        total_score += score

        if score >= 80:
            distribution["excellent"] += 1
        elif score >= 60:
            distribution["good"] += 1
        elif score >= 40:
            distribution["fair"] += 1
        else:
            distribution["poor"] += 1

        for issue in issues:
            issue_counts[issue] = issue_counts.get(issue, 0) + 1

    avg_score = total_score // len(products)

    # Top critical issues sorted by frequency
    critical_issues = sorted(issue_counts.keys(), key=lambda k: -issue_counts[k])[:10]

    return {
        "avg_score": avg_score,
        "total_products": len(products),
        "critical_issues": critical_issues,
        "distribution": distribution,
    }
