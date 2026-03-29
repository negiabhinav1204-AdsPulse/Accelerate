"""Scraper models — web scraping results."""

from typing import Literal

from pydantic import BaseModel, Field


class PageMetadata(BaseModel):
    title: str = ""
    description: str = ""
    status_code: int = 200
    favicon_url: str | None = None
    og_image: str | None = None
    theme_color: str | None = None
    brand_colors: list[str] = Field(default_factory=list)
    page_type: Literal["homepage", "product", "category", "other"] = "homepage"
    is_shopify: bool = False


class ShopifyImage(BaseModel):
    src: str
    position: int = 1
    width: int | None = None
    height: int | None = None
    alt: str | None = None


class ShopifyVariant(BaseModel):
    title: str
    price: str
    compare_at_price: str | None = None
    sku: str | None = None
    available: bool = True
    option1: str | None = None
    option2: str | None = None
    option3: str | None = None
    weight: float | None = None
    weight_unit: str | None = None
    requires_shipping: bool = True
    taxable: bool = True
    barcode: str | None = None


class ShopifyProductData(BaseModel):
    product_id: int
    title: str
    handle: str
    description_html: str = ""
    vendor: str = ""
    product_type: str = ""
    tags: list[str] = Field(default_factory=list)
    price: str
    compare_at_price: str | None = None
    currency: str = "INR"
    images: list[ShopifyImage] = Field(default_factory=list)
    featured_image: ShopifyImage | None = None
    variants: list[ShopifyVariant] = Field(default_factory=list)
    options: list[dict[str, object]] = Field(default_factory=list)
    product_url: str = ""
    created_at: str | None = None
    updated_at: str | None = None
    published_at: str | None = None

    @property
    def discount_percentage(self) -> float | None:
        if self.compare_at_price and self.price:
            try:
                original = float(self.compare_at_price)
                sale = float(self.price)
                if original > 0:
                    return round(((original - sale) / original) * 100, 1)
            except ValueError:
                pass
        return None

    @property
    def image_urls(self) -> list[str]:
        return [img.src for img in sorted(self.images, key=lambda i: i.position)]

    @property
    def offer_tags(self) -> list[str]:
        offer_keywords = ("offer", "coupon", "sale", "discount", "flat", "eoss")
        return [tag for tag in self.tags if any(kw in tag.lower() for kw in offer_keywords)]


class GenericProductData(BaseModel):
    title: str
    brand: str | None = None
    price: str | None = None
    currency: str = "INR"
    original_price: str | None = None
    coupon: str | None = None
    deal_type: str | None = None
    rating: str | None = None
    review_count: str | None = None
    availability: str | None = None
    images: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    description: str | None = None
    asin: str | None = None
    product_url: str = ""
    platform: str = "unknown"

    @property
    def discount_percentage(self) -> float | None:
        if self.original_price and self.price:
            try:
                original = float(self.original_price.replace(",", ""))
                sale = float(self.price.replace(",", ""))
                if original > 0:
                    return round(((original - sale) / original) * 100, 1)
            except ValueError:
                pass
        return None

    @property
    def formatted_price(self) -> str:
        if not self.price:
            return ""
        symbol = "₹" if self.currency == "INR" else self.currency
        return f"{symbol}{self.price}"


class WebsiteContent(BaseModel):
    url: str
    markdown: str = ""
    text: str = ""
    metadata: PageMetadata = Field(default_factory=PageMetadata)
    shopify_product: ShopifyProductData | None = None
    generic_product: GenericProductData | None = None
    is_successful: bool = True
    error_message: str | None = None

    @property
    def product_data(self) -> ShopifyProductData | GenericProductData | None:
        return self.shopify_product or self.generic_product
