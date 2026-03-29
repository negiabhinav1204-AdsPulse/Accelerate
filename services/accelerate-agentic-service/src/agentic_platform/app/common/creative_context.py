"""Contextual creative scene builder — vertical detection + audience persona + scene directives.

Converts product description + audience targeting into a concrete scene brief
that replaces generic "product on background" image prompts with lifestyle
photography directions: "25-year-old American woman wearing beach shorts on
Miami Beach at golden hour".

Importable by both app/campaigns/ and app/accelera/ modules.
Zero LLM cost — pure deterministic Python.
"""

from __future__ import annotations
from typing import TypedDict


# ══════════════════════════════════════════════════════════════════════════════
# VERTICAL DETECTION
# ══════════════════════════════════════════════════════════════════════════════

_VERTICAL_KEYWORDS: dict[str, list[str]] = {
    "fashion": [
        "shirt", "t-shirt", "tee", "blouse", "top", "dress", "gown", "skirt",
        "pants", "trousers", "jeans", "shorts", "leggings", "hoodie", "sweatshirt",
        "sweater", "cardigan", "jacket", "coat", "blazer", "suit", "formal",
        "casual", "sportswear", "activewear", "swimwear", "bikini", "swimsuit",
        "underwear", "lingerie", "shoes", "sneakers", "boots", "sandals", "heels",
        "loafers", "slip-on", "bag", "handbag", "purse", "backpack", "wallet",
        "belt", "hat", "cap", "beanie", "scarf", "gloves", "sunglasses", "eyewear",
        "jewelry", "ring", "necklace", "bracelet", "earrings", "watch", "fashion",
        "clothing", "apparel", "wear", "outfit", "collection", "wardrobe",
        "footwear", "accessory", "accessories", "streetwear", "athleisure",
        "denim", "linen", "cotton", "leather", "suede",
    ],
    "beauty": [
        "serum", "moisturizer", "cream", "lotion", "sunscreen", "spf", "face wash",
        "cleanser", "toner", "essence", "mask", "eye cream", "lip balm", "lip care",
        "foundation", "concealer", "powder", "blush", "bronzer", "highlighter",
        "eyeshadow", "eyeliner", "mascara", "lipstick", "lip gloss", "makeup",
        "cosmetic", "beauty", "skincare", "haircare", "shampoo", "conditioner",
        "hair oil", "hair mask", "hair color", "dye", "nail polish", "nail care",
        "perfume", "fragrance", "cologne", "deodorant", "body wash", "body lotion",
        "soap", "scrub", "exfoliant", "glow", "brightening", "anti-aging", "retinol",
        "vitamin c", "hyaluronic", "peptide", "collagen", "niacinamide", "aha", "bha",
    ],
    "food": [
        "coffee", "tea", "juice", "smoothie", "protein shake", "energy drink",
        "soda", "water", "beer", "wine", "spirits", "whiskey", "vodka", "cocktail",
        "food", "snack", "chocolate", "candy", "cookie", "cake", "bread", "pasta",
        "sauce", "spice", "seasoning", "oil", "vinegar", "meal", "dish", "recipe",
        "restaurant", "cafe", "bakery", "pizza", "burger", "sushi", "taco",
        "burrito", "salad", "soup", "dessert", "ice cream", "nutrition", "organic",
        "vegan", "keto", "paleo", "beverage", "drink", "supplement shake",
        "nutrition bar", "granola", "cereal", "honey", "jam",
    ],
    "sports": [
        "gym", "fitness", "workout", "exercise", "yoga", "pilates", "running",
        "jogging", "cycling", "swimming", "hiking", "climbing", "crossfit",
        "weightlifting", "dumbbells", "barbell", "kettlebell", "resistance band",
        "treadmill", "stationary bike", "rowing machine", "sports", "athletic",
        "training", "recovery", "protein powder", "creatine", "pre-workout",
        "energy gel", "tennis", "basketball", "football", "soccer", "golf",
        "skiing", "snowboard", "surf", "surfboard", "paddle", "martial arts",
        "boxing", "mma", "judo", "karate", "badminton", "volleyball", "baseball",
        "hockey", "rugby", "lacrosse", "sport", "outdoor gear", "trail",
    ],
    "tech": [
        "laptop", "computer", "pc", "mac", "tablet", "ipad", "smartphone", "phone",
        "software", "app", "application", "platform", "saas", "b2b", "enterprise",
        "api", "cloud", "ai", "artificial intelligence", "machine learning", "data",
        "analytics", "dashboard", "tool", "gadget", "headphone", "earphone",
        "speaker", "camera", "webcam", "microphone", "drone", "smartwatch",
        "wearable", "charger", "keyboard", "mouse", "monitor", "router", "vpn",
        "cybersecurity", "startup", "tech", "technology", "digital", "developer",
        "coding", "programming", "automation", "workflow", "integration", "plugin",
        "extension", "saas tool", "productivity", "remote work",
    ],
    "healthcare": [
        "health", "medical", "medicine", "vitamin", "supplement", "probiotic",
        "omega", "cbd", "wellness", "mental health", "therapy", "meditation",
        "mindfulness", "dental", "oral care", "optometry", "vision", "clinic",
        "hospital", "treatment", "prevention", "diagnostic", "device", "monitor",
        "blood pressure", "glucose", "sleep", "pain relief", "immune", "gut health",
        "fertility", "pregnancy", "baby", "pediatric", "elderly", "rehabilitation",
        "physical therapy", "pharmacy", "telehealth", "wearable health",
    ],
    "automotive": [
        "car", "vehicle", "automobile", "truck", "suv", "van", "pickup",
        "motorcycle", "motorbike", "bike", "scooter", "electric vehicle", "ev",
        "hybrid", "engine", "motor", "tire", "wheel", "oil", "accessories",
        "auto", "automotive", "driving", "transport", "fleet", "rental",
        "insurance", "gps", "dash cam", "seat cover", "steering", "detailing",
    ],
    "home": [
        "furniture", "sofa", "couch", "chair", "recliner", "table", "desk",
        "shelf", "bookcase", "wardrobe", "closet", "bed", "mattress", "pillow",
        "duvet", "blanket", "lamp", "lighting", "chandelier", "rug", "curtain",
        "blind", "kitchen", "cookware", "pot", "pan", "knife", "appliance",
        "blender", "mixer", "coffee maker", "air fryer", "cleaning", "vacuum",
        "mop", "organizer", "storage", "basket", "plant", "garden", "outdoor",
        "patio", "home", "interior", "decor", "decoration", "living room",
        "bedroom", "bathroom", "office furniture", "home office",
    ],
    "pets": [
        "dog", "cat", "pet", "puppy", "kitten", "bird", "fish", "hamster",
        "rabbit", "guinea pig", "pet food", "dog food", "cat food", "treat",
        "toy", "collar", "leash", "harness", "pet bed", "crate", "carrier",
        "grooming", "brush", "pet shampoo", "veterinary", "flea", "tick",
        "pet supplement", "aquarium",
    ],
    "travel": [
        "travel", "trip", "vacation", "holiday", "tour", "hotel", "resort",
        "airbnb", "flight", "airline", "cruise", "adventure", "destination",
        "luggage", "suitcase", "backpack", "travel bag", "passport", "visa",
        "travel insurance", "guide", "experience", "explore", "journey", "tourism",
        "hostel", "camping", "hiking gear",
    ],
    "education": [
        "course", "class", "lesson", "tutorial", "training", "certification",
        "degree", "school", "university", "college", "education", "learning",
        "skill", "bootcamp", "workshop", "webinar", "e-learning", "online course",
        "study", "exam", "test prep", "textbook", "curriculum", "edtech",
        "tutoring", "language learning",
    ],
    "finance": [
        "finance", "fintech", "banking", "investment", "trading", "stock",
        "crypto", "insurance", "loan", "mortgage", "credit card", "payment",
        "wallet", "money", "savings", "wealth", "tax", "accounting", "audit",
        "financial planning", "robo-advisor", "neobank",
    ],
}


def detect_vertical(description: str, category_hint: str = "") -> str:
    """Detect product vertical from description + optional category hint.

    Uses keyword matching — zero LLM cost.
    category_hint: pre-classified category from product catalog (e.g. "casual wear").
    Returns vertical name or "general".
    """
    text = (description + " " + category_hint).lower()
    scores: dict[str, int] = {}
    for vertical, keywords in _VERTICAL_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[vertical] = score
    return max(scores, key=scores.get) if scores else "general"


# ══════════════════════════════════════════════════════════════════════════════
# LOCATION CONTEXT
# country code → nationality + vertical-specific setting descriptions
# ══════════════════════════════════════════════════════════════════════════════

_LOCATION_CONTEXT: dict[str, dict] = {
    "US": {
        "nationality": "American",
        "settings": {
            "fashion":      "a sun-drenched Los Angeles street, Miami Beach boardwalk, or New York City sidewalk",
            "beauty":       "a bright modern bathroom or sunlit vanity in a stylish American apartment",
            "food":         "a trendy Brooklyn café, LA juice bar, or Southern backyard barbecue",
            "sports":       "a Santa Monica beach boardwalk, urban gym, or Pacific Northwest forest trail",
            "tech":         "a San Francisco co-working space or minimalist Silicon Valley home office",
            "healthcare":   "a clean modern American home, bright kitchen, or suburban morning walk",
            "automotive":   "an open American highway, scenic Big Sur coastal road, or downtown parking garage",
            "home":         "a modern open-plan American living room with large windows and natural light",
            "pets":         "a sunny American suburban backyard, city dog park, or living room couch",
            "travel":       "a vibrant US airport departure hall or iconic American landmark",
            "education":    "a modern American university campus or bright co-working study space",
            "finance":      "a sleek American office or modern urban coffee meeting",
            "general":      "a modern American lifestyle setting — urban, suburban, or coastal",
        },
    },
    "UK": {
        "nationality": "British",
        "settings": {
            "fashion":      "a London street, Edinburgh cobblestone alley, or English countryside",
            "beauty":       "a bright London flat bathroom or garden terrace",
            "food":         "a cozy London café, traditional pub, or Borough Market food stall",
            "sports":       "a London park running path, British gym, or Cotswolds countryside trail",
            "tech":         "a London Shoreditch tech hub, co-working space, or home study",
            "healthcare":   "a clean British home, NHS clinic waiting area, or park morning walk",
            "automotive":   "a British country road, London urban street, or motorway",
            "home":         "a classic British terraced house interior with period details and modern touches",
            "pets":         "an English countryside field or London Victoria Park",
            "general":      "a modern British lifestyle setting — London urban or English countryside",
        },
    },
    "IN": {
        "nationality": "Indian",
        "settings": {
            "fashion":      "a vibrant Mumbai street, Bangalore tech district, or Delhi market",
            "beauty":       "a modern Indian apartment, rooftop terrace, or bright morning setting",
            "food":         "a trendy Mumbai café, Delhi street food scene, or Bangalore restaurant",
            "sports":       "an Indian gym, cricket ground, or city park morning run",
            "tech":         "a Bangalore tech office, startup hub, or modern Indiranagar co-working space",
            "healthcare":   "a clean modern Indian clinic, wellness studio, or morning yoga session",
            "automotive":   "a Mumbai expressway, Goa coastal road, or scenic Indian highway",
            "home":         "a modern Indian apartment with warm tones, natural light, and contemporary design",
            "pets":         "an Indian park or modern apartment setting",
            "general":      "a modern Indian urban lifestyle setting — Bangalore, Mumbai, or Delhi",
        },
    },
    "AU": {
        "nationality": "Australian",
        "settings": {
            "fashion":      "a Bondi Beach boardwalk, Melbourne laneway, or Sydney harbour promenade",
            "beauty":       "a bright Australian bathroom, rooftop terrace, or outdoor brunch setting",
            "food":         "a Sydney brunch café, beachside barbecue, or Melbourne laneway restaurant",
            "sports":       "a Sydney beach, outdoor gym with harbour view, or bush trail",
            "tech":         "a Sydney startup office or Melbourne CBD co-working space",
            "automotive":   "an Australian outback highway, coastal Great Ocean Road, or Sydney suburb",
            "general":      "a modern Australian lifestyle setting — outdoor, sunny, relaxed, coastal",
        },
    },
    "CA": {
        "nationality": "Canadian",
        "settings": {
            "fashion":      "a Toronto street, Vancouver waterfront, or Montreal market quarter",
            "sports":       "a Canadian mountain trail, hockey rink, or Vancouver seawall",
            "automotive":   "a Canadian mountain highway, Toronto downtown, or British Columbia forest road",
            "tech":         "a Toronto tech district or Vancouver co-working space",
            "general":      "a modern Canadian lifestyle setting — urban Toronto or outdoor BC nature",
        },
    },
    "DE": {
        "nationality": "German",
        "settings": {
            "fashion":      "a Berlin Mitte street, Munich plaza, or Hamburg Alster promenade",
            "tech":         "a Berlin startup office, Munich engineering hub, or Hamburg digital agency",
            "automotive":   "a German autobahn, Alpine mountain road, or Stuttgart urban street",
            "food":         "a Berlin café, Munich beer garden, or Hamburg harbour restaurant",
            "general":      "a modern German lifestyle setting — clean, efficient, quality-focused",
        },
    },
    "FR": {
        "nationality": "French",
        "settings": {
            "fashion":      "a Parisian street, Le Marais boutique district, or French Riviera promenade",
            "beauty":       "a Parisian vanity, French pharmacy, or garden terrace in morning light",
            "food":         "a Parisian café terrace, brasserie, or Provençal market",
            "general":      "a modern French lifestyle setting — elegant, effortless, Parisian chic",
        },
    },
    "AE": {
        "nationality": "Emirati",
        "settings": {
            "fashion":      "a Dubai Mall atrium, rooftop pool terrace, or Jumeirah Beach Walk",
            "automotive":   "a Dubai Sheikh Zayed Road, desert highway, or luxury hotel valet",
            "food":         "a Dubai rooftop restaurant, Souk Madinat café, or beach club",
            "general":      "a modern Dubai lifestyle setting — luxury, architectural, aspirational",
        },
    },
    "SG": {
        "nationality": "Singaporean",
        "settings": {
            "fashion":      "an Orchard Road shopping street, Marina Bay waterfront, or Tiong Bahru neighbourhood",
            "food":         "a Singapore hawker centre, rooftop bar, or café in Duxton Hill",
            "tech":         "a Singapore fintech hub, one-north startup campus, or CBD co-working space",
            "general":      "a modern Singapore lifestyle setting — clean, urban, multicultural, efficient",
        },
    },
    "JP": {
        "nationality": "Japanese",
        "settings": {
            "fashion":      "a Tokyo Harajuku street, Shibuya crossing, or Osaka market alley",
            "beauty":       "a clean minimalist Japanese bathroom or pharmacy setting",
            "food":         "a Tokyo ramen shop, convenience store, or rooftop izakaya",
            "tech":         "a Tokyo office, Akihabara tech district, or sleek co-working space",
            "general":      "a modern Japanese lifestyle setting — precise, aesthetic, urban",
        },
    },
    "BR": {
        "nationality": "Brazilian",
        "settings": {
            "fashion":      "an Ipanema beach boardwalk, São Paulo fashion district, or Rio rooftop",
            "food":         "a São Paulo café, Rio beach kiosk, or Brazilian barbecue churrascaria",
            "sports":       "a Brazilian beach volleyball court, gym, or Copacabana running path",
            "general":      "a modern Brazilian lifestyle setting — vibrant, colourful, energetic",
        },
    },
}

_FALLBACK_SETTINGS: dict[str, str] = {
    "fashion":    "a sun-drenched urban street or lifestyle destination",
    "beauty":     "a bright, clean bathroom or sunlit vanity setting",
    "food":       "a welcoming café, restaurant, or outdoor dining setting",
    "sports":     "an outdoor sports environment — beach, trail, or gym",
    "tech":       "a modern co-working space or minimalist home office",
    "healthcare": "a clean, bright wellness setting",
    "automotive": "an open highway or aspirational outdoor driving location",
    "home":       "a beautifully styled modern living space with natural light",
    "pets":       "a sunny park or cozy home setting",
    "travel":     "a vibrant travel destination or airport",
    "education":  "a bright study environment or modern campus",
    "finance":    "a sleek, professional office or business meeting setting",
    "general":    "a premium lifestyle setting",
}


def _resolve_location_code(locations: list[str]) -> str:
    """Pick the first recognised country code from a list of location strings."""
    for loc in locations:
        code = loc.strip().upper()
        # Handle common full names
        name_map = {
            "UNITED STATES": "US", "UNITED KINGDOM": "UK", "GREAT BRITAIN": "UK",
            "INDIA": "IN", "AUSTRALIA": "AU", "CANADA": "CA", "GERMANY": "DE",
            "FRANCE": "FR", "UNITED ARAB EMIRATES": "AE", "UAE": "AE",
            "SINGAPORE": "SG", "JAPAN": "JP", "BRAZIL": "BR",
        }
        if code in _LOCATION_CONTEXT:
            return code
        if code in name_map:
            return name_map[code]
        # Try first two chars as code
        if code[:2] in _LOCATION_CONTEXT:
            return code[:2]
    return "US"  # sensible default


# ══════════════════════════════════════════════════════════════════════════════
# VERTICAL PLAYBOOK
# how each vertical should be photographed
# ══════════════════════════════════════════════════════════════════════════════

class _VerticalPlaybook(TypedDict):
    needs_person: bool
    person_verb: str        # "wearing", "using", "enjoying", "driving", "applying"
    camera_style: str
    lighting: str


_VERTICAL_PLAYBOOK: dict[str, _VerticalPlaybook] = {
    "fashion": {
        "needs_person": True,
        "person_verb": "wearing",
        "camera_style": "full-body or three-quarter lifestyle editorial shot, confident natural pose",
        "lighting": "golden hour sunlight or bright natural daylight",
    },
    "beauty": {
        "needs_person": True,
        "person_verb": "applying or showing the radiant results of",
        "camera_style": "close-up beauty portrait or three-quarter shot, focus on glowing skin or face",
        "lighting": "soft diffused natural light or ring-lit studio, even and flattering",
    },
    "food": {
        "needs_person": True,
        "person_verb": "enjoying or about to eat/drink",
        "camera_style": "lifestyle shot, person interacting naturally with product in setting",
        "lighting": "warm ambient café light or bright outdoor daylight, appetite-stimulating",
    },
    "sports": {
        "needs_person": True,
        "person_verb": "actively using during sport or exercise",
        "camera_style": "dynamic action shot or caught-in-motion lifestyle photography",
        "lighting": "bright outdoor sunlight or dramatic gym lighting, high energy",
    },
    "tech": {
        "needs_person": True,
        "person_verb": "using, interacting with, or visibly benefiting from",
        "camera_style": "over-shoulder or three-quarter shot, screen or interface visible, person engaged and focused",
        "lighting": "cool modern office light or warm home studio ambient light",
    },
    "healthcare": {
        "needs_person": True,
        "person_verb": "using or visibly thriving and benefiting from",
        "camera_style": "clean lifestyle portrait, person radiates health and vitality",
        "lighting": "bright optimistic natural light — morning glow, clean and uplifting",
    },
    "automotive": {
        "needs_person": True,
        "person_verb": "driving or standing confidently beside",
        "camera_style": "wide lifestyle shot, vehicle prominent, person adds human scale and aspiration",
        "lighting": "golden hour or dramatic cloudy sky, cinematic wide angle",
    },
    "home": {
        "needs_person": False,  # interior lifestyle — product IS the hero
        "person_verb": "featured in a beautifully styled",
        "camera_style": "interior lifestyle shot, architectural photography with human warmth",
        "lighting": "natural window light streaming in, warm and inviting",
    },
    "pets": {
        "needs_person": True,
        "person_verb": "sharing a joyful moment with their pet and",
        "camera_style": "candid lifestyle shot, pet and owner are co-heroes",
        "lighting": "bright warm natural daylight, joyful and alive",
    },
    "travel": {
        "needs_person": True,
        "person_verb": "traveling freely with",
        "camera_style": "wide lifestyle shot, destination is the aspirational backdrop",
        "lighting": "golden hour travel photography, adventurous and free",
    },
    "education": {
        "needs_person": True,
        "person_verb": "actively learning and engaged with",
        "camera_style": "over-shoulder or profile shot — focused, motivated, growth mindset",
        "lighting": "bright study environment, natural daylight or warm desk lamp",
    },
    "finance": {
        "needs_person": True,
        "person_verb": "confidently using or benefiting from",
        "camera_style": "clean professional lifestyle shot, person looks empowered and in control",
        "lighting": "crisp office light or bright urban café setting",
    },
    "general": {
        "needs_person": True,
        "person_verb": "using or benefiting from",
        "camera_style": "lifestyle editorial shot, natural and authentic",
        "lighting": "golden hour or bright natural daylight",
    },
}


# ══════════════════════════════════════════════════════════════════════════════
# AUDIENCE PERSONA BUILDER
# ══════════════════════════════════════════════════════════════════════════════

_AGE_DESCRIPTORS: list[tuple[int, int, str]] = [
    (13, 17, "teenage"),
    (18, 24, "college-age"),
    (25, 34, "young professional"),
    (35, 44, "professional"),
    (45, 54, "established"),
    (55, 99, "mature"),
]


def _age_label(age_min: int, age_max: int) -> str:
    mid = (age_min + age_max) // 2
    age_str = f"{mid}-year-old"
    for lo, hi, descriptor in _AGE_DESCRIPTORS:
        if lo <= mid <= hi:
            return age_str  # just the age number, descriptor is implicit
    return age_str


def _gender_noun(gender: str) -> str:
    g = gender.lower().strip()
    if g in ("male", "man", "men", "m", "1"):
        return "man"
    if g in ("female", "woman", "women", "f", "2"):
        return "woman"
    return "person"  # mixed / ALL → gender-neutral, let model decide


def build_audience_persona(
    age_min: int,
    age_max: int,
    gender: str,
    locations: list[str],
) -> tuple[str, str]:
    """
    Build a persona description and resolve location code.

    Returns:
        persona: e.g. "25-year-old American woman"
        location_code: e.g. "US"
    """
    age_mid = (age_min + age_max) // 2 if (age_min and age_max) else 28
    age_str = f"{age_mid}-year-old"
    gender_noun = _gender_noun(gender)
    location_code = _resolve_location_code(locations)
    nationality = _LOCATION_CONTEXT.get(location_code, {}).get("nationality", "")

    parts = [age_str]
    if nationality:
        parts.append(nationality)
    parts.append(gender_noun)

    return " ".join(parts), location_code


# ══════════════════════════════════════════════════════════════════════════════
# SCENE DIRECTIVE BUILDER — the core output
# ══════════════════════════════════════════════════════════════════════════════

def build_scene_directive(
    product_description: str,
    vertical: str,
    persona: str,
    location_code: str,
) -> str:
    """
    Build a concrete scene directive for the image model.

    Replaces generic slot directions ("hero banner with product as focal point")
    with specific lifestyle scene descriptions ("25-year-old American woman
    wearing beach shorts on Miami Beach at golden hour").

    Always returns a string suitable for prepending to the image prompt.
    """
    playbook = _VERTICAL_PLAYBOOK.get(vertical, _VERTICAL_PLAYBOOK["general"])
    verb = playbook["person_verb"]
    camera = playbook["camera_style"]
    lighting = playbook["lighting"]

    # Resolve location-specific setting
    loc_settings = _LOCATION_CONTEXT.get(location_code, {}).get("settings", {})
    setting = (
        loc_settings.get(vertical)
        or loc_settings.get("general")
        or _FALLBACK_SETTINGS.get(vertical)
        or "a premium lifestyle setting"
    )

    if playbook["needs_person"]:
        directive = (
            f"[SCENE DIRECTIVE] Show a {persona} {verb} {product_description}. "
            f"Setting: {setting}. "
            f"Lighting: {lighting}. "
            f"Shot: {camera}. "
            f"The person feels real, natural, and aspirational — this is LIFESTYLE EDITORIAL "
            f"photography, not a product-only studio shot. "
            f"The product is clearly visible, well-styled, and the undeniable visual hero. "
            f"Photorealistic. Shot on a Hasselblad with 85mm lens. Magazine-cover quality."
        )
    else:
        # Home/furniture vertical — interior lifestyle, no person needed
        directive = (
            f"[SCENE DIRECTIVE] Show {product_description} "
            f"{verb} interior. "
            f"Setting: {setting}. "
            f"Lighting: {lighting}. "
            f"Shot: {camera}. "
            f"The space feels aspirational, livable, and premium. "
            f"Photorealistic. Architectural lifestyle photography. Magazine quality."
        )

    return directive


# ══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE: parse age range string "18-35" → (18, 35)
# ══════════════════════════════════════════════════════════════════════════════

def parse_age_range(age_range: str) -> tuple[int, int]:
    """Parse "18-35" → (18, 35). Returns (18, 35) on failure."""
    try:
        parts = age_range.strip().split("-")
        if len(parts) == 2:
            return int(parts[0].strip()), int(parts[1].strip())
    except (ValueError, AttributeError):
        pass
    return 18, 35
