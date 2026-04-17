const OPFF_BASE_URL = 'https://world.openpetfoodfacts.org';
const productCache = new Map();
const categoryCache = new Map();
let catalogCache = null;

const buildSearchUrl = (categoryTag) => {
  const params = new URLSearchParams({
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '50',
    page: '1',
  });

  if (categoryTag) {
    params.set('tagtype_0', 'categories');
    params.set('tag_contains_0', 'contains');
    params.set('tag_0', categoryTag);
  }

  return `${OPFF_BASE_URL}/cgi/search.pl?${params.toString()}`;
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Pet Food Facts request failed with status ${response.status}`);
  }

  return response.json();
};

const getProductName = (product) => product?.product_name || product?.generic_name || product?.brands || 'Pet Food Product';

const getProductImage = (product) =>
  product?.image_url || product?.image_front_url || product?.image_small_url || 'https://via.placeholder.com/400x400?text=Pet+Food';

const getProductDescription = (product) =>
  product?.ingredients_text || product?.generic_name || product?.categories || 'Dummy pet food product from Open Pet Food Facts.';

const getIngredientsText = (product) => {
  if (product?.ingredients_text) {
    return product.ingredients_text;
  }

  if (Array.isArray(product?.ingredients) && product.ingredients.length > 0) {
    return product.ingredients
      .map((item) => item?.text)
      .filter(Boolean)
      .join(', ');
  }

  return '';
};

const getAllergensText = (product) => {
  const fromIngredients = product?.allergens_from_ingredients || '';
  const allergens = product?.allergens || '';
  const traces = product?.traces || '';
  return [fromIngredients, allergens, traces].filter(Boolean).join(' ');
};

const getProductCategory = (product) => {
  const tags = product?.categories_tags || [];
  if (tags.some((tag) => tag.includes('dog-food'))) {
    return 'Dog';
  }

  if (tags.some((tag) => tag.includes('cat-food'))) {
    return 'Cat';
  }

  return 'Pet';
};

const getDemoPrice = (product) => {
  const quantity = Number(product?.product_quantity || 0);
  const codeSeed = Number(String(product?.code || product?._id || '100').slice(-4)) || 100;
  const price = Math.round(quantity ? quantity * 0.8 : codeSeed);
  return Math.max(99, price);
};

export const mapOpenPetFoodProduct = (product) => ({
  _id: product?.code || product?._id,
  title: getProductName(product),
  image: getProductImage(product),
  price: getDemoPrice(product),
  description: getProductDescription(product),
  ingredients: getIngredientsText(product),
  allergens: getAllergensText(product),
  category: getProductCategory(product),
  brand: product?.brands || 'Open Pet Food Facts',
  source: 'openpetfoodfacts',
});

export const fetchOpenPetFoodCatalog = async () => {
  if (catalogCache) {
    return catalogCache;
  }

  const data = await fetchJson(buildSearchUrl());
  const products = Array.isArray(data?.products) ? data.products : [];
  const mappedProducts = products
    .filter((product) => product?.product_type === 'petfood' || (product?.categories_tags || []).some((tag) => tag.includes('dog-food') || tag.includes('cat-food')))
    .map(mapOpenPetFoodProduct)
    .filter((product) => product._id);

  catalogCache = mappedProducts.length > 0 ? mappedProducts : products.map(mapOpenPetFoodProduct).filter((product) => product._id);
  return catalogCache;
};

export const fetchOpenPetFoodByCategory = async (category) => {
  const categoryKey = String(category || '').toLowerCase();
  if (categoryCache.has(categoryKey)) {
    return categoryCache.get(categoryKey);
  }

  const tag = categoryKey === 'dog' ? 'dog-food' : 'cat-food';
  const data = await fetchJson(buildSearchUrl(tag));
  const products = Array.isArray(data?.products) ? data.products : [];
  const mappedProducts = products
    .map(mapOpenPetFoodProduct)
    .filter((product) => product._id);

  categoryCache.set(categoryKey, mappedProducts);
  return mappedProducts;
};

export const fetchOpenPetFoodDetails = async (code) => {
  if (productCache.has(code)) {
    return productCache.get(code);
  }

  const data = await fetchJson(`${OPFF_BASE_URL}/api/v0/product/${code}.json`);
  const product = mapOpenPetFoodProduct(data?.product || {});
  productCache.set(code, product);
  return product;
};

export const clearOpenPetFoodCache = () => {
  catalogCache = null;
  categoryCache.clear();
  productCache.clear();
};
