/**
 * Google Product Taxonomy — curated subset of the most common e-commerce categories.
 * Full taxonomy: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 * Used for Default Google Category and Default Meta Category fields in Feed Settings.
 */

export type TaxonomyEntry = {
  id: number;
  name: string; // Full path, e.g. "Apparel & Accessories > Clothing > Tops & Tees"
};

export const GOOGLE_TAXONOMY: TaxonomyEntry[] = [
  // ── Animals & Pet Supplies ─────────────────────────────────────────────────
  { id: 1, name: 'Animals & Pet Supplies' },
  { id: 3, name: 'Animals & Pet Supplies > Pet Supplies' },
  { id: 4, name: 'Animals & Pet Supplies > Pet Supplies > Cat Supplies' },
  { id: 5, name: 'Animals & Pet Supplies > Pet Supplies > Dog Supplies' },
  { id: 6, name: 'Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Apparel' },
  { id: 8, name: 'Animals & Pet Supplies > Pet Supplies > Pet Food' },
  { id: 9, name: 'Animals & Pet Supplies > Pet Supplies > Pet Beds & Bedding' },
  { id: 10, name: 'Animals & Pet Supplies > Pet Supplies > Pet Collars & Leashes' },

  // ── Apparel & Accessories ─────────────────────────────────────────────────
  { id: 166, name: 'Apparel & Accessories' },
  { id: 1604, name: 'Apparel & Accessories > Clothing' },
  { id: 5441, name: 'Apparel & Accessories > Clothing > Activewear' },
  { id: 3982, name: 'Apparel & Accessories > Clothing > Dresses' },
  { id: 2271, name: 'Apparel & Accessories > Clothing > Outerwear' },
  { id: 212, name: 'Apparel & Accessories > Clothing > Pants' },
  { id: 209, name: 'Apparel & Accessories > Clothing > Shirts & Tops' },
  { id: 1581, name: 'Apparel & Accessories > Clothing > Skirts' },
  { id: 207, name: 'Apparel & Accessories > Clothing > Shorts' },
  { id: 211, name: 'Apparel & Accessories > Clothing > Sleepwear & Loungewear' },
  { id: 213, name: 'Apparel & Accessories > Clothing > Suits' },
  { id: 205, name: 'Apparel & Accessories > Clothing > Swimwear' },
  { id: 210, name: 'Apparel & Accessories > Clothing > Underwear & Socks' },
  { id: 2306, name: 'Apparel & Accessories > Clothing > Uniforms' },
  { id: 167, name: 'Apparel & Accessories > Handbags, Wallets & Cases' },
  { id: 3032, name: 'Apparel & Accessories > Handbags, Wallets & Cases > Handbags' },
  { id: 3011, name: 'Apparel & Accessories > Handbags, Wallets & Cases > Wallets & Money Clips' },
  { id: 178, name: 'Apparel & Accessories > Jewelry' },
  { id: 6100, name: 'Apparel & Accessories > Jewelry > Bracelets' },
  { id: 191, name: 'Apparel & Accessories > Jewelry > Earrings' },
  { id: 6464, name: 'Apparel & Accessories > Jewelry > Necklaces' },
  { id: 6467, name: 'Apparel & Accessories > Jewelry > Rings' },
  { id: 171, name: 'Apparel & Accessories > Shoes' },
  { id: 187, name: 'Apparel & Accessories > Shoes > Athletic Shoes' },
  { id: 181, name: 'Apparel & Accessories > Shoes > Boots' },
  { id: 188, name: 'Apparel & Accessories > Shoes > Flats' },
  { id: 1933, name: 'Apparel & Accessories > Shoes > Heels' },
  { id: 184, name: 'Apparel & Accessories > Shoes > Sandals' },
  { id: 189, name: 'Apparel & Accessories > Shoes > Sneakers' },
  { id: 3066, name: 'Apparel & Accessories > Clothing Accessories' },
  { id: 169, name: 'Apparel & Accessories > Clothing Accessories > Belts' },
  { id: 176, name: 'Apparel & Accessories > Clothing Accessories > Hats & Caps' },
  { id: 3581, name: 'Apparel & Accessories > Clothing Accessories > Scarves & Shawls' },
  { id: 3872, name: 'Apparel & Accessories > Clothing Accessories > Sunglasses' },
  { id: 179, name: 'Apparel & Accessories > Clothing Accessories > Watches' },

  // ── Arts & Entertainment ──────────────────────────────────────────────────
  { id: 784, name: 'Arts & Entertainment' },
  { id: 5710, name: 'Arts & Entertainment > Hobbies & Creative Arts' },
  { id: 505378, name: 'Arts & Entertainment > Hobbies & Creative Arts > Art & Crafts' },
  { id: 5709, name: 'Arts & Entertainment > Music & Sound Recordings' },
  { id: 5713, name: 'Arts & Entertainment > Party & Celebration' },
  { id: 96, name: 'Arts & Entertainment > Party & Celebration > Gift Giving' },
  { id: 97, name: 'Arts & Entertainment > Party & Celebration > Gift Giving > Gift Sets & Kits' },

  // ── Baby & Toddler ────────────────────────────────────────────────────────
  { id: 537, name: 'Baby & Toddler' },
  { id: 5252, name: 'Baby & Toddler > Baby Clothing' },
  { id: 561, name: 'Baby & Toddler > Diapering' },
  { id: 542, name: 'Baby & Toddler > Feeding' },
  { id: 548, name: 'Baby & Toddler > Nursery' },
  { id: 556, name: 'Baby & Toddler > Strollers & Accessories' },
  { id: 5637, name: 'Baby & Toddler > Baby Toys' },

  // ── Business & Industrial ─────────────────────────────────────────────────
  { id: 111, name: 'Business & Industrial' },
  { id: 957, name: 'Business & Industrial > Office Supplies' },

  // ── Cameras & Optics ─────────────────────────────────────────────────────
  { id: 152, name: 'Cameras & Optics' },
  { id: 154, name: 'Cameras & Optics > Cameras' },
  { id: 155, name: 'Cameras & Optics > Cameras > Digital Cameras' },
  { id: 2096, name: 'Cameras & Optics > Camera & Optics Accessories' },

  // ── Electronics ──────────────────────────────────────────────────────────
  { id: 222, name: 'Electronics' },
  { id: 899, name: 'Electronics > Audio' },
  { id: 5507, name: 'Electronics > Audio > Headphones & Headsets' },
  { id: 2368, name: 'Electronics > Audio > Speakers' },
  { id: 224, name: 'Electronics > Communications' },
  { id: 4169, name: 'Electronics > Communications > Phones & Accessories' },
  { id: 267, name: 'Electronics > Communications > Phones & Accessories > Mobile Phones' },
  { id: 4561, name: 'Electronics > Communications > Phones & Accessories > Phone Accessories' },
  { id: 4745, name: 'Electronics > Communications > Phones & Accessories > Phone Cases' },
  { id: 328, name: 'Electronics > Computers' },
  { id: 5296, name: 'Electronics > Computers > Laptops' },
  { id: 298, name: 'Electronics > Computers > Tablets' },
  { id: 3695, name: 'Electronics > Computers > Computer Accessories' },
  { id: 232, name: 'Electronics > Electronics Accessories' },
  { id: 6938, name: 'Electronics > Electronics Accessories > Cables & Adapters' },
  { id: 5567, name: 'Electronics > Electronics Accessories > Chargers & Power Supplies' },
  { id: 386, name: 'Electronics > Video' },
  { id: 387, name: 'Electronics > Video > Televisions' },
  { id: 2152, name: 'Electronics > Video > Video Players & Recorders' },
  { id: 4977, name: 'Electronics > Print, Copy, Scan & Fax' },
  { id: 393, name: 'Electronics > Print, Copy, Scan & Fax > Printers' },
  { id: 6014, name: 'Electronics > Smart Home Devices' },
  { id: 3593, name: 'Electronics > Wearable Technology' },

  // ── Food, Beverages & Tobacco ─────────────────────────────────────────────
  { id: 422, name: 'Food, Beverages & Tobacco' },
  { id: 5765, name: 'Food, Beverages & Tobacco > Beverages' },
  { id: 423, name: 'Food, Beverages & Tobacco > Food Items' },
  { id: 427, name: 'Food, Beverages & Tobacco > Food Items > Snack Foods' },

  // ── Furniture ─────────────────────────────────────────────────────────────
  { id: 436, name: 'Furniture' },
  { id: 6345, name: 'Furniture > Beds & Accessories' },
  { id: 441, name: 'Furniture > Chairs' },
  { id: 443, name: 'Furniture > Shelving & Storage' },
  { id: 6328, name: 'Furniture > Sofas & Sectionals' },
  { id: 6362, name: 'Furniture > Tables' },

  // ── Health & Beauty ───────────────────────────────────────────────────────
  { id: 469, name: 'Health & Beauty' },
  { id: 2915, name: 'Health & Beauty > Health Care' },
  { id: 491, name: 'Health & Beauty > Health Care > Fitness & Nutrition' },
  { id: 2739, name: 'Health & Beauty > Health Care > Medical Devices' },
  { id: 2915, name: 'Health & Beauty > Health Care > Vitamins & Supplements' },
  { id: 567, name: 'Health & Beauty > Personal Care' },
  { id: 2644, name: 'Health & Beauty > Personal Care > Cosmetics' },
  { id: 2658, name: 'Health & Beauty > Personal Care > Cosmetics > Eye Makeup' },
  { id: 2660, name: 'Health & Beauty > Personal Care > Cosmetics > Face Makeup' },
  { id: 2661, name: 'Health & Beauty > Personal Care > Cosmetics > Lip Makeup' },
  { id: 2664, name: 'Health & Beauty > Personal Care > Cosmetics > Nail Products' },
  { id: 2907, name: 'Health & Beauty > Personal Care > Hair Care' },
  { id: 477, name: 'Health & Beauty > Personal Care > Oral Care' },
  { id: 476, name: 'Health & Beauty > Personal Care > Skin Care' },
  { id: 2844, name: 'Health & Beauty > Personal Care > Skin Care > Facial Care' },
  { id: 486, name: 'Health & Beauty > Personal Care > Skin Care > Lotions & Moisturizers' },
  { id: 484, name: 'Health & Beauty > Personal Care > Skin Care > Sunscreens & Sunblock' },
  { id: 2640, name: 'Health & Beauty > Personal Care > Fragrances & Perfumes' },

  // ── Home & Garden ─────────────────────────────────────────────────────────
  { id: 536, name: 'Home & Garden' },
  { id: 588, name: 'Home & Garden > Bedding' },
  { id: 591, name: 'Home & Garden > Bedding > Bed Sheets & Pillowcases' },
  { id: 592, name: 'Home & Garden > Bedding > Blankets & Throws' },
  { id: 2814, name: 'Home & Garden > Bedding > Pillows' },
  { id: 673, name: 'Home & Garden > Decor' },
  { id: 3509, name: 'Home & Garden > Decor > Candles & Home Fragrance' },
  { id: 4193, name: 'Home & Garden > Decor > Clocks' },
  { id: 696, name: 'Home & Garden > Decor > Curtains & Drapes' },
  { id: 701, name: 'Home & Garden > Decor > Rugs' },
  { id: 4166, name: 'Home & Garden > Decor > Vases' },
  { id: 676, name: 'Home & Garden > Decor > Wall Art' },
  { id: 4055, name: 'Home & Garden > Kitchen & Dining' },
  { id: 654, name: 'Home & Garden > Kitchen & Dining > Cookware' },
  { id: 640, name: 'Home & Garden > Kitchen & Dining > Kitchen Appliances' },
  { id: 649, name: 'Home & Garden > Kitchen & Dining > Tableware' },
  { id: 4352, name: 'Home & Garden > Lawn & Garden' },
  { id: 2962, name: 'Home & Garden > Lawn & Garden > Gardening' },
  { id: 729, name: 'Home & Garden > Lighting' },
  { id: 6052, name: 'Home & Garden > Storage & Organization' },

  // ── Luggage & Bags ────────────────────────────────────────────────────────
  { id: 5181, name: 'Luggage & Bags' },
  { id: 5182, name: 'Luggage & Bags > Backpacks' },
  { id: 110, name: 'Luggage & Bags > Luggage' },
  { id: 5183, name: 'Luggage & Bags > Tote Bags' },
  { id: 3676, name: 'Luggage & Bags > Travel Accessories' },

  // ── Media ─────────────────────────────────────────────────────────────────
  { id: 783, name: 'Media' },
  { id: 839, name: 'Media > Books' },
  { id: 855, name: 'Media > Movies & TV' },
  { id: 863, name: 'Media > Music' },
  { id: 377, name: 'Media > Video Games' },

  // ── Office Supplies ───────────────────────────────────────────────────────
  { id: 922, name: 'Office Supplies' },
  { id: 923, name: 'Office Supplies > General Office Supplies' },

  // ── Software ─────────────────────────────────────────────────────────────
  { id: 311, name: 'Software' },

  // ── Sporting Goods ────────────────────────────────────────────────────────
  { id: 988, name: 'Sporting Goods' },
  { id: 990, name: 'Sporting Goods > Exercise & Fitness' },
  { id: 3502, name: 'Sporting Goods > Exercise & Fitness > Cardio Equipment' },
  { id: 499829, name: 'Sporting Goods > Exercise & Fitness > Exercise Mats' },
  { id: 499830, name: 'Sporting Goods > Exercise & Fitness > Free Weights' },
  { id: 499862, name: 'Sporting Goods > Exercise & Fitness > Yoga & Pilates' },
  { id: 499821, name: 'Sporting Goods > Outdoor Recreation' },
  { id: 3465, name: 'Sporting Goods > Outdoor Recreation > Camping & Hiking' },
  { id: 1093, name: 'Sporting Goods > Outdoor Recreation > Cycling' },
  { id: 3467, name: 'Sporting Goods > Outdoor Recreation > Water Sports' },
  { id: 1144, name: 'Sporting Goods > Team Sports' },
  { id: 4003, name: 'Sporting Goods > Team Sports > Basketball' },
  { id: 1146, name: 'Sporting Goods > Team Sports > Football' },
  { id: 1154, name: 'Sporting Goods > Team Sports > Soccer' },

  // ── Toys & Games ─────────────────────────────────────────────────────────
  { id: 1239, name: 'Toys & Games' },
  { id: 1253, name: 'Toys & Games > Dolls & Action Figures' },
  { id: 1249, name: 'Toys & Games > Games' },
  { id: 3793, name: 'Toys & Games > Games > Board Games' },
  { id: 1262, name: 'Toys & Games > Puzzles' },
  { id: 1264, name: 'Toys & Games > Remote-Controlled Toys' },
  { id: 1267, name: 'Toys & Games > Stuffed Animals' },

  // ── Vehicles & Parts ─────────────────────────────────────────────────────
  { id: 1267, name: 'Vehicles & Parts' },
  { id: 8237, name: 'Vehicles & Parts > Vehicle Parts & Accessories' },
  { id: 916, name: 'Vehicles & Parts > Vehicle Parts & Accessories > Car Accessories' }
];
