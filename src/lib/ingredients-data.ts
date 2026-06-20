// Anima Companion — Structured ingredient data by product slug
// Used as fallback when DB ingredients field is plain text (not JSON).
// Frontend parses this map by slug to render Ingredient Spotlight tab.
// To override: update product.ingredients in admin panel with JSON string format.

export type Ingredient = {
  name: string;
  dose: string;
  benefit: string;
  icon: 'leaf' | 'heart' | 'bone' | 'shield' | 'eye' | 'sun' | 'activity' | 'sparkles' | 'drop' | 'star';
};

export const INGREDIENTS_BY_SLUG: Record<string, Ingredient[]> = {
  'immuno-plus': [
    { name: 'Vitamin C', dose: '50 mg', benefit: 'Antioksidan kuat, boost sistem imun', icon: 'shield' },
    { name: 'Echinacea', dose: '25 mg', benefit: 'Stimulasi sel darah putih', icon: 'leaf' },
    { name: 'Zinc', dose: '10 mg', benefit: 'Penting untuk respons imun adaptif', icon: 'shield' },
    { name: 'Vitamin E', dose: '15 IU', benefit: 'Proteksi sel dari stres oksidatif', icon: 'leaf' },
    { name: 'Selenium', dose: '20 mcg', benefit: 'Sinergis dengan Vitamin E', icon: 'star' },
    { name: 'Beta Glucan', dose: '30 mg', benefit: 'Aktivator makrofag', icon: 'shield' },
  ],
  'appetite-booster': [
    { name: 'Vitamin B Complex', dose: '20 mg', benefit: 'Stimulasi nafsu makan & energi', icon: 'activity' },
    { name: 'L-Lysine', dose: '100 mg', benefit: 'Asam amino esensial, penting untuk kucing', icon: 'heart' },
    { name: 'Zinc', dose: '8 mg', benefit: 'Pembuka nafsu makan alami', icon: 'shield' },
    { name: 'Ginger Extract', dose: '15 mg', benefit: 'Menenangkan lambung, anti-mual', icon: 'leaf' },
    { name: 'Fenugreek', dose: '20 mg', benefit: 'Herba penguat nafsu makan', icon: 'leaf' },
  ],
  'skin-and-coat-care': [
    { name: 'Omega 3 (EPA+DHA)', dose: '180 mg', benefit: 'Kulit sehat, bulu mengkilap', icon: 'drop' },
    { name: 'Omega 6', dose: '120 mg', benefit: 'Mencegah kulit kering & gatal', icon: 'drop' },
    { name: 'Biotin (Vit B7)', dose: '500 mcg', benefit: 'Penguat struktur bulu', icon: 'sparkles' },
    { name: 'Zinc', dose: '15 mg', benefit: 'Regenerasi sel kulit', icon: 'shield' },
    { name: 'Vitamin A', dose: '1000 IU', benefit: 'Kesehatan epidermis', icon: 'eye' },
    { name: 'Vitamin E', dose: '20 IU', benefit: 'Antioksidan untuk kulit', icon: 'leaf' },
  ],
  'hip-and-joint-advanced': [
    { name: 'Glucosamine HCl', dose: '500 mg', benefit: 'Bahan baku cairan sendi', icon: 'bone' },
    { name: 'Chondroitin Sulfate', dose: '400 mg', benefit: 'Proteksi tulang rawan', icon: 'bone' },
    { name: 'MSM', dose: '250 mg', benefit: 'Anti-inflamasi alami', icon: 'leaf' },
    { name: 'Green Lipped Mussel', dose: '100 mg', benefit: 'Sumber alami glucosamine + omega', icon: 'drop' },
    { name: 'Hyaluronic Acid', dose: '20 mg', benefit: 'Pelumas sendi', icon: 'drop' },
    { name: 'Vitamin C', dose: '75 mg', benefit: 'Sintesis kolagen', icon: 'shield' },
  ],
  'probiotic-digest': [
    { name: 'Lactobacillus acidophilus', dose: '2 B CFU', benefit: 'Bakteri baik untuk usus', icon: 'activity' },
    { name: 'Bifidobacterium', dose: '1 B CFU', benefit: 'Keseimbangan flora usus besar', icon: 'activity' },
    { name: 'Prebiotic FOS', dose: '100 mg', benefit: 'Makanan bakteri baik', icon: 'leaf' },
    { name: 'Papaya Extract', dose: '50 mg', benefit: 'Enzim pencernaan papain', icon: 'leaf' },
    { name: 'Inulin', dose: '80 mg', benefit: 'Serat prebiotik alami', icon: 'leaf' },
  ],
  'eye-care-solution': [
    { name: 'Lutein', dose: '5 mg', benefit: 'Filter cahaya biru, proteksi retina', icon: 'eye' },
    { name: 'Zeaxanthin', dose: '2 mg', benefit: 'Konsentrasi tinggi di makula', icon: 'eye' },
    { name: 'Vitamin A', dose: '2000 IU', benefit: 'Penglihatan malam', icon: 'eye' },
    { name: 'Vitamin E', dose: '15 IU', benefit: 'Antioksidan untuk mata', icon: 'leaf' },
    { name: 'Astaxanthin', dose: '2 mg', benefit: 'Antioksidan mata terkuat', icon: 'star' },
    { name: 'Grape Seed Extract', dose: '25 mg', benefit: 'Sirkulasi darah ke mata', icon: 'leaf' },
  ],
  'omega-3-salmon-oil': [
    { name: 'EPA', dose: '180 mg', benefit: 'Anti-inflamasi, jantung sehat', icon: 'drop' },
    { name: 'DHA', dose: '120 mg', benefit: 'Otak & penglihatan', icon: 'drop' },
    { name: 'Vitamin E', dose: '10 IU', benefit: 'Stabilisasi minyak, antioksidan', icon: 'leaf' },
    { name: 'Wild Salmon Oil', dose: '1000 mg', benefit: 'Source murni dari salmon liar Alaska', icon: 'drop' },
  ],
  'multi-vitamin-daily': [
    { name: 'Vitamin A', dose: '1500 IU', benefit: 'Penglihatan & kulit', icon: 'eye' },
    { name: 'Vitamin B Complex', dose: '25 mg', benefit: 'Energi & saraf', icon: 'activity' },
    { name: 'Vitamin C', dose: '50 mg', benefit: 'Imun & antioksidan', icon: 'shield' },
    { name: 'Vitamin D3', dose: '200 IU', benefit: 'Penyerapan kalsium', icon: 'sun' },
    { name: 'Vitamin E', dose: '20 IU', benefit: 'Antioksidan utama', icon: 'leaf' },
    { name: 'Calcium', dose: '100 mg', benefit: 'Tulang & gigi', icon: 'bone' },
    { name: 'Taurine', dose: '100 mg', benefit: 'Jantung & mata kucing', icon: 'heart' },
    { name: 'Iron', dose: '5 mg', benefit: 'Darah sehat', icon: 'activity' },
  ],
};

export function getIngredients(slug: string): Ingredient[] {
  return INGREDIENTS_BY_SLUG[slug] || [];
}
