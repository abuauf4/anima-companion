import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🌱 Seeding Anima Companion — Zesty Paws Marketplace Edition...')

  // ==================== CLEAN UP (correct FK order) ====================
  await db.petProfile.deleteMany()   // FK to PetType + User
  await db.fAQ.deleteMany()
  await db.testimonial.deleteMany()
  await db.banner.deleteMany()
  await db.orderItem.deleteMany()
  await db.order.deleteMany()
  await db.cartItem.deleteMany()
  await db.cart.deleteMany()
  await db.wishlist.deleteMany()
  await db.review.deleteMany()
  await db.productPetType.deleteMany()
  await db.productProblem.deleteMany()
  await db.productImage.deleteMany()
  await db.product.deleteMany()      // FK to Seller (nullable, OK)
  await db.seller.deleteMany()
  await db.category.deleteMany()
  await db.petType.deleteMany()
  await db.problem.deleteMany()
  await db.voucher.deleteMany()
  await db.user.deleteMany()

  // ==================== ADMIN USER ====================
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await db.user.create({
    data: {
      email: 'admin@anima.id',
      password: adminPassword,
      name: 'Admin Anima',
      phone: '081234567890',
      role: 'ADMIN',
    },
  })
  console.log('✅ Admin user created:', admin.email)

  // ==================== DEMO CUSTOMER ====================
  const customerPassword = await bcrypt.hash('customer123', 10)
  const customer = await db.user.create({
    data: {
      email: 'budi@example.com',
      password: customerPassword,
      name: 'Budi Santoso',
      phone: '081298765432',
      role: 'CUSTOMER',
    },
  })
  console.log('✅ Demo customer created:', customer.email)

  // ==================== CATEGORIES ====================
  const categories = await db.$transaction([
    db.category.create({ data: { name: 'Vitamin', slug: 'vitamin', icon: 'pill' } }),
    db.category.create({ data: { name: 'Suplemen', slug: 'suplemen', icon: 'flask' } }),
    db.category.create({ data: { name: 'Perawatan', slug: 'perawatan', icon: 'heart' } }),
    db.category.create({ data: { name: 'Grooming', slug: 'grooming', icon: 'sparkles' } }),
  ])
  console.log('✅ Categories created:', categories.length)

  // ==================== PET TYPES ====================
  const petTypes = await db.$transaction([
    db.petType.create({ data: { name: 'Kucing', slug: 'kucing', icon: 'cat' } }),
    db.petType.create({ data: { name: 'Anjing', slug: 'anjing', icon: 'dog' } }),
    db.petType.create({ data: { name: 'Burung', slug: 'burung', icon: 'bird' } }),
    db.petType.create({ data: { name: 'Ikan', slug: 'ikan', icon: 'fish' } }),
    db.petType.create({ data: { name: 'Hewan Kecil', slug: 'hewan-kecil', icon: 'rabbit' } }),
  ])
  console.log('✅ Pet types created:', petTypes.length)

  // ==================== PROBLEMS (Shop By Problem) ====================
  const problems = await db.$transaction([
    db.problem.create({
      data: {
        name: 'Imunitas',
        slug: 'imunitas',
        description: 'Tingkatkan daya tahan tubuh hewan peliharaan agar tidak mudah sakit.',
        icon: 'shield',
        color: '#3B82F6',
      },
    }),
    db.problem.create({
      data: {
        name: 'Nafsu Makan',
        slug: 'nafsu-makan',
        description: 'Bantu hewan kembali lahap makan dan nutrisi tercukupi.',
        icon: 'utensils',
        color: '#EF4444',
      },
    }),
    db.problem.create({
      data: {
        name: 'Bulu & Kulit',
        slug: 'bulu-dan-kulit',
        description: 'Bulu sehat, mengkilap, dan kulit bebas masalah.',
        icon: 'sparkles',
        color: '#EC4899',
      },
    }),
    db.problem.create({
      data: {
        name: 'Tulang & Sendi',
        slug: 'tulang-dan-sendi',
        description: 'Jaga mobilitas dan kesehatan sendi hewan peliharaan.',
        icon: 'bone',
        color: '#F59E0B',
      },
    }),
    db.problem.create({
      data: {
        name: 'Pencernaan',
        slug: 'pencernaan',
        description: 'Sistem pencernaan sehat, penyerapan nutrisi optimal.',
        icon: 'activity',
        color: '#22C55E',
      },
    }),
    db.problem.create({
      data: {
        name: 'Mata',
        slug: 'mata',
        description: 'Jaga kesehatan mata dan ketajaman penglihatan.',
        icon: 'eye',
        color: '#7C3AED',
      },
    }),
    db.problem.create({
      data: {
        name: 'Recovery',
        slug: 'recovery',
        description: 'Membantu pemulihan setelah sakit atau operasi.',
        icon: 'heart',
        color: '#F43F5E',
      },
    }),
    db.problem.create({
      data: {
        name: 'Harian',
        slug: 'harian',
        description: 'Multivitamin harian untuk menjaga kesehatan optimal.',
        icon: 'sun',
        color: '#F97316',
      },
    }),
  ])
  console.log('✅ Problems created:', problems.length)

  // ==================== SELLERS / BRANDS (Marketplace) ====================
  const sellers = await db.$transaction([
    db.seller.create({
      data: {
        name: 'Zesty Paws ID',
        slug: 'zesty-paws',
        tagline: 'Premium US-style pet supplements',
        description: 'Zesty Paws menghadirkan suplemen premium berkualitas tinggi untuk kucing dan anjing. Formula dengan bahan alami terbaik, dibuat di USA dengan standar GMP.',
        location: 'Jakarta, Indonesia (Distributor Resmi)',
        rating: 4.9,
        totalSales: 1250,
        isActive: true,
        isVerified: true,
      },
    }),
    db.seller.create({
      data: {
        name: 'Native Pet',
        slug: 'native-pet',
        tagline: 'Natural & organic supplements',
        description: 'Native Pet fokus pada suplemen alami dengan bahan organik. Tanpa pengawet, tanpa pewarna buatan, aman untuk hewan peliharaan sensitif.',
        location: 'Surabaya, Indonesia',
        rating: 4.8,
        totalSales: 890,
        isActive: true,
        isVerified: true,
      },
    }),
    db.seller.create({
      data: {
        name: 'Vetri Science',
        slug: 'vetri-science',
        tagline: 'Vet-formulated supplements',
        description: 'Vetri Science Laboratories — formula yang dikembangkan oleh dokter hewan bersertifikat. Produk dengan kualitas farmasi untuk hasil klinis nyata.',
        location: 'Bandung, Indonesia',
        rating: 4.9,
        totalSales: 640,
        isActive: true,
        isVerified: true,
      },
    }),
    db.seller.create({
      data: {
        name: 'Pet Honesty',
        slug: 'pet-honesty',
        tagline: 'Health-focused supplements',
        description: 'Pet Honesty dibuat dengan bahan premium dan transparansi penuh. Setiap produk diuji pihak ketiga untuk memastikan kualitas dan kemurnian.',
        location: 'Jakarta, Indonesia',
        rating: 4.7,
        totalSales: 720,
        isActive: true,
        isVerified: false,
      },
    }),
    db.seller.create({
      data: {
        name: 'Anima Companion',
        slug: 'anima-companion',
        tagline: 'Local Indonesian brand',
        description: 'Brand lokal Anima Companion — riset IPB & BRIN. Formula khusus untuk iklim dan pola makan hewan peliharaan di Indonesia.',
        location: 'Bogor, Indonesia',
        rating: 4.8,
        totalSales: 1580,
        isActive: true,
        isVerified: true,
      },
    }),
  ])
  console.log('✅ Sellers/Brands created:', sellers.length)

  const sellerBySlug = (slug: string) => sellers.find((s) => s.slug === slug)!

  // ==================== PRODUCTS (15 marketplace products) ====================
  const img = (label: string, color: string, idx: number) =>
    `https://placehold.co/600x600/${color}/ffffff?text=${encodeURIComponent(label + ' ' + (idx + 1))}`

  // Helper: subscribe price = 15% off (rounded to nearest 1000)
  const sub = (price: number) => Math.round(price * 0.85 / 1000) * 1000

  interface ProductSeed {
    name: string
    slug: string
    sku: string
    brand: string
    sellerSlug: string
    price: number
    salePrice: number | null
    subscribePrice: number | null
    isSubscribeEligible: boolean
    stock: number
    weight: string
    description: string
    benefit: string
    usage: string
    ingredients: string
    bpomNumber: string
    isBestSeller: boolean
    isNew: boolean
    rating: number
    reviewCount: number
    categorySlug: string
    problemSlugs: string[]
    petTypeSlugs: string[]
    color: string
  }

  const productsData: ProductSeed[] = [
    // ============ ZESTY PAWS (7 products) ============
    {
      name: 'Zesty Paws Probiotic Bites for Dogs',
      slug: 'zesty-paws-probiotic-bites-dogs',
      sku: 'ZP-PBD-001',
      brand: 'Zesty Paws',
      sellerSlug: 'zesty-paws',
      price: 145000,
      salePrice: 125000,
      subscribePrice: sub(125000),
      isSubscribeEligible: true,
      stock: 48,
      weight: '90 chewable bites',
      description:
        'Probiotic Bites for Dogs dari Zesty Paws — suplemen probiotik premium dengan 6 strain bakteri baik dan prebiotik untuk kesehatan pencernaan anjing. Membantu mengatasi diare, kembung, dan meningkatkan penyerapan nutrisi.',
      benefit:
        'Menyeimbangkan mikroflora usus, mengatasi diare dan masalah pencernaan, memperkuat imunitas, dan meningkatkan penyerapan nutrisi. Anjing lebih sehat dan aktif.',
      usage:
        'Anjing <11kg: 1 bite sehari.\nAnjing 11-23kg: 2 bites sehari.\nAnjing >23kg: 3 bites sehari.\nDiberikan sebagai camilan atau dicampur makanan.',
      ingredients:
        'Probiotic Blend 6B CFU (Lactobacillus acidophilus, L. rhamnosus, Bifidobacterium animalis), Prebiotic FOS 200mg, Pumpkin 50mg, Digestive Enzymes 25mg.',
      bpomNumber: 'BPOM TR 211234567001',
      isBestSeller: true,
      isNew: false,
      rating: 4.9,
      reviewCount: 42,
      categorySlug: 'suplemen',
      problemSlugs: ['pencernaan', 'imunitas'],
      petTypeSlugs: ['anjing'],
      color: 'F97316',
    },
    {
      name: 'Zesty Paws 8-in-1 Multivitamin Bites for Dogs',
      slug: 'zesty-paws-8in1-multivitamin-dogs',
      sku: 'ZP-MV8-002',
      brand: 'Zesty Paws',
      sellerSlug: 'zesty-paws',
      price: 175000,
      salePrice: null,
      subscribePrice: sub(175000),
      isSubscribeEligible: true,
      stock: 32,
      weight: '90 chewable bites',
      description:
        'Multivitamin 8-in-1 untuk anjing — satu produk untuk 8 manfaat: imunitas, bulu, sendi, pencernaan, jantung, hati, mata, dan energi. Formula lengkap untuk menjaga kesehatan menyeluruh anjing peliharaan.',
      benefit:
        '8 manfaat dalam 1 produk: imunitas, bulu sehat, sendi kuat, pencernaan lancar, jantung sehat, fungsi hati, mata jernih, dan energi harian. Cocok untuk anjing semua usia.',
      usage:
        'Anjing <11kg: 1 bite sehari.\nAnjing 11-23kg: 2 bites sehari.\nAnjing >23kg: 3 bites sehari.\nDiberikan setiap hari setelah makan.',
      ingredients:
        'Vitamin A 5000IU, Vitamin B Kompleks, Vitamin C 50mg, Vitamin D3 500IU, Vitamin E 50IU, Glucosamine 250mg, Omega 3 200mg, Probiotic 1B CFU.',
      bpomNumber: 'BPOM TR 211234567002',
      isBestSeller: true,
      isNew: false,
      rating: 4.8,
      reviewCount: 38,
      categorySlug: 'vitamin',
      problemSlugs: ['harian', 'imunitas'],
      petTypeSlugs: ['anjing'],
      color: '7C3AED',
    },
    {
      name: 'Zesty Paws Hip & Joint Advanced Bites',
      slug: 'zesty-paws-hip-joint-advanced',
      sku: 'ZP-HJA-003',
      brand: 'Zesty Paws',
      sellerSlug: 'zesty-paws',
      price: 195000,
      salePrice: 165000,
      subscribePrice: sub(165000),
      isSubscribeEligible: true,
      stock: 25,
      weight: '90 chewable bites',
      description:
        'Hip & Joint Advanced Bites — formula extra strength untuk kesehatan sendi anjing. Dengan Glucosamine, Chondroitin, MSM, dan Turmeric yang membantu menjaga mobilitas anjing senior atau anjing aktif.',
      benefit:
        'Mengurangi peradangan sendi, meningkatkan mobilitas, mencegah osteoarthritis, dan membantu pemulihan pasca operasi. Hasil terlihat dalam 4-6 minggu.',
      usage:
        'Anjing <11kg: 1 bite sehari.\nAnjing 11-23kg: 2 bites sehari.\nAnjing >23kg: 3 bites sehari.\nUntuk hasil maksimal, gunakan rutin minimal 6 minggu.',
      ingredients:
        'Glucosamine HCl 500mg, Chondroitin Sulfate 200mg, MSM 150mg, Turmeric Curcumin 100mg, Hyaluronic Acid 10mg, Vitamin C 50mg.',
      bpomNumber: 'BPOM TR 211234567003',
      isBestSeller: false,
      isNew: false,
      rating: 4.9,
      reviewCount: 28,
      categorySlug: 'suplemen',
      problemSlugs: ['tulang-dan-sendi', 'recovery'],
      petTypeSlugs: ['anjing'],
      color: 'F59E0B',
    },
    {
      name: 'Zesty Paws Calming Bites for Cats',
      slug: 'zesty-paws-calming-bites-cats',
      sku: 'ZP-CBC-004',
      brand: 'Zesty Paws',
      sellerSlug: 'zesty-paws',
      price: 135000,
      salePrice: null,
      subscribePrice: sub(135000),
      isSubscribeEligible: true,
      stock: 40,
      weight: '60 soft chews',
      description:
        'Calming Bites untuk kucing — suplemen penenang alami yang membantu kucing tetap tenang saat situasi stres (tamanya dokter, perjalanan, kembarnya tamu, atau petasan). Dengan L-Theanine, L-Tryptophan, dan chamomile.',
      benefit:
        'Membantu kucing tetap tenang tanpa mengantuk, mengurangi stres dan kecemasan, membantu perilaku agresif, dan meningkatkan kualitas tidur. Aman digunakan jangka panjang.',
      usage:
        'Kucing <5kg: 1 chew sehari.\nKucing >5kg: 2 chews sehari.\nBerikan 30 menit sebelum situasi stres atau rutin setiap hari.',
      ingredients:
        'L-Theanine 50mg, L-Tryptophan 30mg, Chamomile Extract 25mg, Passion Flower 20mg, Ginger 15mg, Magnesium 10mg.',
      bpomNumber: 'BPOM TR 211234567004',
      isBestSeller: false,
      isNew: true,
      rating: 4.7,
      reviewCount: 15,
      categorySlug: 'suplemen',
      problemSlugs: ['harian'],
      petTypeSlugs: ['kucing'],
      color: 'EC4899',
    },
    {
      name: 'Zesty Paws Skin & Coat Omega Bites',
      slug: 'zesty-paws-skin-coat-omega-bites',
      sku: 'ZP-SCO-005',
      brand: 'Zesty Paws',
      sellerSlug: 'zesty-paws',
      price: 155000,
      salePrice: null,
      subscribePrice: sub(155000),
      isSubscribeEligible: true,
      stock: 35,
      weight: '90 chewable bites',
      description:
        'Skin & Coat Omega Bites — suplemen untuk bulu dan kulit dengan kandungan Omega 3 (EPA & DHA), Biotin, dan Vitamin E. Membuat bulu lebih tebal, mengkilap, dan kulit bebas gatal.',
      benefit:
        'Mengatasi bulu rontok, kulit kering dan gatal, ketombe, serta membuat bulu lebih tebal dan mengkilap. Hasil terlihat dalam 3-4 minggu pemakaian rutin.',
      usage:
        'Kucing & anjing kecil: 1 bite sehari.\nAnjing besar: 2-3 bites sehari.\nDiberikan sebagai camilan atau dicampur makanan.',
      ingredients:
        'Omega 3 EPA 180mg, DHA 120mg, Omega 6 GLA 50mg, Biotin 500mcg, Vitamin E 30IU, Salmon Oil 200mg, Flaxseed 100mg.',
      bpomNumber: 'BPOM TR 211234567005',
      isBestSeller: false,
      isNew: false,
      rating: 4.8,
      reviewCount: 22,
      categorySlug: 'suplemen',
      problemSlugs: ['bulu-dan-kulit'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: 'EC4899',
    },
    {
      name: 'Zesty Paws Allergy & Immune Bites for Dogs',
      slug: 'zesty-paws-allergy-immune-dogs',
      sku: 'ZP-AID-006',
      brand: 'Zesty Paws',
      sellerSlug: 'zesty-paws',
      price: 165000,
      salePrice: null,
      subscribePrice: sub(165000),
      isSubscribeEligible: true,
      stock: 28,
      weight: '90 chewable bites',
      description:
        'Allergy & Immune Bites — suplemen untuk anjing dengan alergi dan daya tahan tubuh lemah. Dengan colostrum, quercetin, dan epicatechin yang membantu meredakan gejala alergi dan memperkuat sistem imun.',
      benefit:
        'Meredakan gatal-gatal akibat alergi, mengurangi peradangan, memperkuat sistem imun, dan mencegah infeksi. Cocok untuk anjing dengan kulit sensitif.',
      usage:
        'Anjing <11kg: 1 bite sehari.\nAnjing 11-23kg: 2 bites sehari.\nAnjing >23kg: 3 bites sehari.\nDiberikan setiap hari untuk hasil optimal.',
      ingredients:
        'Colostrum 100mg, Quercetin 80mg, Epicatechin 50mg, Vitamin C 50mg, Zinc 10mg, Astragalus 30mg, Reishi Mushroom 25mg.',
      bpomNumber: 'BPOM TR 211234567006',
      isBestSeller: true,
      isNew: false,
      rating: 4.8,
      reviewCount: 31,
      categorySlug: 'suplemen',
      problemSlugs: ['imunitas', 'bulu-dan-kulit'],
      petTypeSlugs: ['anjing'],
      color: '3B82F6',
    },
    {
      name: 'Zesty Paws Urinary Tract Bites for Cats',
      slug: 'zesty-paws-urinary-tract-cats',
      sku: 'ZP-UTC-007',
      brand: 'Zesty Paws',
      sellerSlug: 'zesty-paws',
      price: 175000,
      salePrice: null,
      subscribePrice: sub(175000),
      isSubscribeEligible: true,
      stock: 22,
      weight: '60 soft chews',
      description:
        'Urinary Tract Bites untuk kucing — suplemen khusus kesehatan saluran kemih. Dengan Cranberry, D-Mannose, dan Nettle Leaf yang membantu mencegah FIC (Feline Idiopathic Cystitis) dan batu ginjal.',
      benefit:
        'Menjaga kesehatan saluran kemih, mencegah kristal dan batu, mengurangi peradangan kandung kemih, dan mendukung fungsi ginjal. Wajib untuk kucing dengan riwayat FUS.',
      usage:
        'Kucing <5kg: 1 chew sehari.\nKucing >5kg: 2 chews sehari.\nDiberikan rutin setiap hari.',
      ingredients:
        'Cranberry Extract 150mg, D-Mannose 100mg, Nettle Leaf 80mg, Vitamin C 50mg, Glucosamine 50mg, Corn Silk 30mg.',
      bpomNumber: 'BPOM TR 211234567007',
      isBestSeller: false,
      isNew: true,
      rating: 4.9,
      reviewCount: 12,
      categorySlug: 'suplemen',
      problemSlugs: ['harian'],
      petTypeSlugs: ['kucing'],
      color: '7C3AED',
    },

    // ============ NATIVE PET (2 products) ============
    {
      name: 'Native Pet Probiotic Powder for Dogs',
      slug: 'native-pet-probiotic-powder-dogs',
      sku: 'NP-PPD-008',
      brand: 'Native Pet',
      sellerSlug: 'native-pet',
      price: 125000,
      salePrice: null,
      subscribePrice: sub(125000),
      isSubscribeEligible: true,
      stock: 38,
      weight: '150g powder (30 servings)',
      description:
        'Probiotic Powder untuk anjing dari Native Pet — bubuk probiotik alami dengan 5 miliar CFU. Tanpa rasa, aroma, atau pengawet buatan. Mudah dicampur ke makanan anjing.',
      benefit:
        'Menyeimbangkan flora usus, mengatasi diare dan kembung, meningkatkan penyerapan nutrisi, dan memperkuat sistem imun. 100% natural, aman untuk anjing sensitif.',
      usage:
        'Anjing <10kg: 1 sendok takar (5g) sehari.\nAnjing 10-25kg: 2 sendok takar sehari.\nAnjing >25kg: 3 sendok takar sehari.\nCampurkan ke makanan, berikan 1x sehari.',
      ingredients:
        'Probiotic Blend 5B CFU (Lactobacillus acidophilus, L. plantarum, Bifidobacterium lactis, L. casei), Prebiotic Inulin 500mg, Pumpkin Powder 200mg.',
      bpomNumber: 'BPOM TR 211234567008',
      isBestSeller: false,
      isNew: false,
      rating: 4.7,
      reviewCount: 18,
      categorySlug: 'suplemen',
      problemSlugs: ['pencernaan', 'imunitas'],
      petTypeSlugs: ['anjing'],
      color: '22C55E',
    },
    {
      name: 'Native Pet Omega 3 Salmon Oil',
      slug: 'native-pet-omega-3-salmon-oil',
      sku: 'NP-OSO-009',
      brand: 'Native Pet',
      sellerSlug: 'native-pet',
      price: 110000,
      salePrice: null,
      subscribePrice: sub(110000),
      isSubscribeEligible: true,
      stock: 45,
      weight: '250ml',
      description:
        'Omega 3 Salmon Oil murni dari Native Pet — minyak salmon wild-caught Alaska, kaya EPA dan DHA. Untuk kesehatan bulu, jantung, sendi, dan otak hewan peliharaan.',
      benefit:
        'Bulu lebih tebal dan mengkilap, kulit sehat bebas gatal, jantung kuat, sendi lentur, dan otak berkembang optimal. Aman untuk kucing, anjing, dan burung.',
      usage:
        'Kucing: 1ml per 2kg berat badan.\nAnjing: 2ml per 5kg berat badan.\nBurung: 2-3 tetes ke makanan.\nCampurkan ke makanan, berikan 1x sehari.',
      ingredients:
        'Wild Alaskan Salmon Oil 99.5%, Vitamin E 100IU (antioksidan). Mengandung EPA 18%, DHA 12%.',
      bpomNumber: 'BPOM TR 211234567009',
      isBestSeller: true,
      isNew: false,
      rating: 4.8,
      reviewCount: 26,
      categorySlug: 'suplemen',
      problemSlugs: ['bulu-dan-kulit', 'recovery', 'harian'],
      petTypeSlugs: ['kucing', 'anjing', 'burung'],
      color: 'F43F5E',
    },

    // ============ VETRI SCIENCE (2 products) ============
    {
      name: 'Vetri Science GlycoFlex Hip & Joint',
      slug: 'vetri-science-glycoflex-hip-joint',
      sku: 'VS-GFH-010',
      brand: 'Vetri Science',
      sellerSlug: 'vetri-science',
      price: 220000,
      salePrice: null,
      subscribePrice: sub(220000),
      isSubscribeEligible: true,
      stock: 18,
      weight: '120 chewable tablets',
      description:
        'GlycoFlex Hip & Joint dari Vetri Science Laboratories — vet-formulated dengan GlycOmega Perna canaliculus (green-lipped mussel) untuk kesehatan sendi. Direkomendasikan dokter hewan untuk anjing dengan masalah sendi.',
      benefit:
        'Memperbaiki kartilago sendi, mengurangi peradangan, meningkatkan mobilitas, dan meredakan nyeri. Vet-strength formula yang terbukti klinis.',
      usage:
        'Anjing <13kg: 1 tablet sehari.\nAnjing 14-29kg: 2 tablets sehari.\nAnjing 30-45kg: 3 tablets sehari.\nAnjing >45kg: 4 tablets sehari.',
      ingredients:
        'GlycOmega Perna Canaliculus 300mg, Glucosamine HCl 500mg, DMG 100mg, MSM 100mg, Manganese 5mg.',
      bpomNumber: 'BPOM TR 211234567010',
      isBestSeller: false,
      isNew: false,
      rating: 5.0,
      reviewCount: 9,
      categorySlug: 'suplemen',
      problemSlugs: ['tulang-dan-sendi', 'recovery'],
      petTypeSlugs: ['anjing'],
      color: '0EA5E9',
    },
    {
      name: 'Vetri Science Immune Support for Cats',
      slug: 'vetri-science-immune-support-cats',
      sku: 'VS-ISC-011',
      brand: 'Vetri Science',
      sellerSlug: 'vetri-science',
      price: 145000,
      salePrice: null,
      subscribePrice: sub(145000),
      isSubscribeEligible: true,
      stock: 30,
      weight: '60 chewable tablets',
      description:
        'Immune Support untuk kucing — vet-formulated dengan L-Lysine, colostrum, dan antioxidant blend. Membantu kucing yang sering pilek, flu, atau memiliki FIV/FeLV.',
      benefit:
        'Memperkuat sistem imun, mencegah infeksi virus (herpesvirus, calicivirus), mempercepat penyembuhan, dan menjaga kesehatan saluran napas.',
      usage:
        'Kucing <3kg: 1 tablet sehari.\nKucing >3kg: 2 tablets sehari.\nBoleh dihancurkan dan dicampur makanan.',
      ingredients:
        'L-Lysine 250mg, Bovine Colostrum 100mg, Vitamin C 50mg, Vitamin E 30IU, Zinc 5mg, Selenium 25mcg, Echinacea 30mg.',
      bpomNumber: 'BPOM TR 211234567011',
      isBestSeller: false,
      isNew: true,
      rating: 4.9,
      reviewCount: 8,
      categorySlug: 'suplemen',
      problemSlugs: ['imunitas', 'recovery'],
      petTypeSlugs: ['kucing'],
      color: '3B82F6',
    },

    // ============ PET HONESTY (2 products) ============
    {
      name: 'Pet Honesty Allergy Support for Dogs',
      slug: 'pet-honesty-allergy-support-dogs',
      sku: 'PH-ASD-012',
      brand: 'Pet Honesty',
      sellerSlug: 'pet-honesty',
      price: 155000,
      salePrice: null,
      subscribePrice: sub(155000),
      isSubscribeEligible: true,
      stock: 26,
      weight: '90 soft chews',
      description:
        'Allergy Support untuk anjing dari Pet Honesty — suplemen alami dengan colostrum, salmon oil, dan turmeric. Membantu anjing dengan alergi makanan, alergi kulit, atau gatal-gatal musiman.',
      benefit:
        'Meredakan gatal dan kulit iritasi, mengurangi peradangan, memperkuat sistem imun, dan membuat bulu sehat. Tanpa bahan sintetis.',
      usage:
        'Anjing <11kg: 1 chew sehari.\nAnjing 11-23kg: 2 chews sehari.\nAnjing >23kg: 3 chews sehari.',
      ingredients:
        'Colostrum 150mg, Salmon Oil 200mg, Turmeric 100mg, Quercetin 80mg, Omega 3 150mg, Vitamin C 50mg.',
      bpomNumber: 'BPOM TR 211234567012',
      isBestSeller: false,
      isNew: false,
      rating: 4.7,
      reviewCount: 14,
      categorySlug: 'suplemen',
      problemSlugs: ['imunitas', 'bulu-dan-kulit'],
      petTypeSlugs: ['anjing'],
      color: 'EF4444',
    },
    {
      name: 'Pet Honesty Multivitamin 10-in-1',
      slug: 'pet-honesty-multivitamin-10in1',
      sku: 'PH-MV10-013',
      brand: 'Pet Honesty',
      sellerSlug: 'pet-honesty',
      price: 165000,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 33,
      weight: '90 soft chews',
      description:
        'Multivitamin 10-in-1 untuk anjing — 10 manfaat dalam 1 produk: imunitas, bulu, sendi, jantung, hati, pencernaan, mata, energi, saraf, dan kesehatan gigi.',
      benefit:
        '10 manfaat untuk kesehatan menyeluruh anjing. Cocok untuk anjing semua usia, terutama yang butuh support harian.',
      usage:
        'Anjing <11kg: 1 chew sehari.\nAnjing 11-23kg: 2 chews sehari.\nAnjing >23kg: 3 chews sehari.',
      ingredients:
        'Vitamin A, B Kompleks, C, D3, E, Glucosamine 250mg, Omega 3 200mg, Probiotic 1B CFU, Kelp 50mg, Biotin 500mcg.',
      bpomNumber: 'BPOM TR 211234567013',
      isBestSeller: false,
      isNew: false,
      rating: 4.6,
      reviewCount: 11,
      categorySlug: 'vitamin',
      problemSlugs: ['harian', 'imunitas'],
      petTypeSlugs: ['anjing'],
      color: '7C3AED',
    },

    // ============ ANIMA COMPANION (2 local products) ============
    {
      name: 'Anima Companion Immuno Plus',
      slug: 'immuno-plus',
      sku: 'AC-IMM-014',
      brand: 'Anima Companion',
      sellerSlug: 'anima-companion',
      price: 85000,
      salePrice: 72000,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 50,
      weight: '60 tablet',
      description:
        'Immuno Plus — suplemen imunitas lokal dari Anima Companion. Diformulasikan dengan Echinacea, Vitamin C, dan Zinc untuk meningkatkan daya tahan tubuh kucing dan anjing.',
      benefit:
        'Meningkatkan sistem imun, mencegah infeksi, mempercepat penyembuhan, dan menjaga kesehatan secara keseluruhan. Cocok untuk pemakaian harian atau masa pemulihan.',
      usage:
        'Kucing: 1 tablet sehari, dapat dihancurkan dan dicampur makanan.\nAnjing kecil (<10kg): 1-2 tablet sehari.\nAnjing besar (>10kg): 2-3 tablet sehari.',
      ingredients:
        'Echinacea Purpurea 100mg, Vitamin C 50mg, Zinc Picolinate 5mg, Vitamin E 10IU, Selenium 25mcg, L-Lysine 50mg.',
      bpomNumber: 'BPOM TR 2012345678901',
      isBestSeller: true,
      isNew: false,
      rating: 4.8,
      reviewCount: 36,
      categorySlug: 'suplemen',
      problemSlugs: ['imunitas', 'recovery'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: '3B82F6',
    },
    {
      name: 'Anima Companion Appetite Booster',
      slug: 'appetite-booster',
      sku: 'AC-APP-015',
      brand: 'Anima Companion',
      sellerSlug: 'anima-companion',
      price: 65000,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 35,
      weight: '50 ml',
      description:
        'Appetite Booster — suplemen penambah nafsu makan lokal dengan rasa ikan yang disukai kucing dan anjing. Diformulasi dengan Vitamin B Kompleks dan herbal alami.',
      benefit:
        'Menambah nafsu makan, meningkatkan energi, membantu pertambahan berat badan yang sehat, dan menjaga kestabilan nutrisi harian.',
      usage:
        'Kucing: 1ml per 2kg berat badan, 2x sehari.\nAnjing: 2ml per 5kg berat badan, 2x sehari.\nDapat dicampur langsung ke makanan atau diberikan langsung.',
      ingredients:
        'Vitamin B1 2mg, Vitamin B6 1mg, Vitamin B12 5mcg, Ekstrak Gentian 50mg, Ekstrak Jahe 30mg, L-Carnitine 20mg.',
      bpomNumber: 'BPOM TR 2012345678902',
      isBestSeller: false,
      isNew: false,
      rating: 4.7,
      reviewCount: 22,
      categorySlug: 'suplemen',
      problemSlugs: ['nafsu-makan'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: 'EF4444',
    },
  ]

  for (const p of productsData) {
    const category = categories.find((c) => c.slug === p.categorySlug)!
    const seller = sellerBySlug(p.sellerSlug)
    const product = await db.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        brand: p.brand,
        sellerId: seller.id,
        price: p.price,
        salePrice: p.salePrice,
        subscribePrice: p.subscribePrice,
        isSubscribeEligible: p.isSubscribeEligible,
        stock: p.stock,
        weight: p.weight,
        description: p.description,
        benefit: p.benefit,
        usage: p.usage,
        ingredients: p.ingredients,
        bpomNumber: p.bpomNumber,
        isBestSeller: p.isBestSeller,
        isNew: p.isNew,
        rating: p.rating,
        reviewCount: p.reviewCount,
        categoryId: category.id,
        images: {
          create: [0, 1, 2, 3].map((i) => ({
            url: img(p.name, p.color, i),
            alt: `${p.name} - gambar ${i + 1}`,
            order: i,
          })),
        },
        petTypes: {
          create: p.petTypeSlugs.map((slug) => ({
            petTypeId: petTypes.find((pt) => pt.slug === slug)!.id,
          })),
        },
        problems: {
          create: p.problemSlugs.map((slug) => ({
            problemId: problems.find((pr) => pr.slug === slug)!.id,
          })),
        },
      },
    })
    console.log(`✅ Product created: ${product.name} [${seller.name}]`)
  }

  // ==================== REVIEWS ====================
  const allProducts = await db.product.findMany({ select: { id: true, slug: true, petTypes: { include: { petType: true } } } })
  const reviewTemplates: { userName: string; petType: string; rating: number; comment: string }[] = [
    { userName: 'Diana Pradnya', petType: 'Kucing', rating: 5, comment: 'Bulunya jadi lebih tebal dan mengkilap setelah 3 minggu pakai. Kucing saya suka rasanya juga!' },
    { userName: 'Rizky Aditya', petType: 'Anjing', rating: 5, comment: 'Anjing golden saya yang sebelumnya malas gerak, sekarang lebih aktif. Recommended banget!' },
    { userName: 'Maya Sari', petType: 'Kucing', rating: 4, comment: 'Bagus untuk pencernaan kucing persian saya yang sensitif. Pengiriman juga cepat.' },
    { userName: 'Fajar Ramadhan', petType: 'Anjing', rating: 5, comment: 'Hip & Joint Advanced benar-benar membantu anjing senior saya. Sudah pesan ulang 3x.' },
    { userName: 'Tika Maharani', petType: 'Kucing', rating: 5, comment: 'Nafsu makan kucing saya yang lagi drop langsung balik. Owner juga fast response di WA.' },
    { userName: 'Andre Wijaya', petType: 'Anjing', rating: 4, comment: 'Produk bagus, packing rapi. Anjing saya suka rasanya, jadi gampang dikasih.' },
    { userName: 'Putri Lestari', petType: 'Kucing', rating: 5, comment: 'Kucing saya yang sering muntah setelah pakai probiotik ini jadi sehat. Worth the price!' },
    { userName: 'Hendra Gunawan', petType: 'Anjing', rating: 5, comment: 'Vet-strength beneran. Anjing husky saya jadi lebih lincah walau udah 8 tahun.' },
    { userName: 'Sari Wulandari', petType: 'Kucing', rating: 4, comment: 'Calm bites bantu kucing saya yang stres saat ke dokter. Aman dan tidak bikin ngantuk.' },
    { userName: 'Bagus Santoso', petType: 'Anjing', rating: 5, comment: 'Multivitamin lengkap, satu produk untuk semua kebutuhan. Harga sepadan dengan kualitas.' },
    { userName: 'Indah Permata', petType: 'Kucing', rating: 5, comment: 'Urinary tract bites wajib untuk kucing yang sering FUS. Sudah 6 bulan pakai, aman.' },
    { userName: 'Yoga Pratama', petType: 'Anjing', rating: 4, comment: 'Allergy support membantu anjing saya yang alergi kulit. Gatal-gatal berkurang signifikan.' },
  ]

  // Distribute reviews across products deterministically
  for (let i = 0; i < allProducts.length; i++) {
    const product = allProducts[i]
    const numReviews = 2 + (i % 3) // 2-4 reviews per product
    for (let j = 0; j < numReviews; j++) {
      const template = reviewTemplates[(i * 3 + j) % reviewTemplates.length]
      const petTypeFromProduct = product.petTypes[0]?.petType.name || template.petType
      await db.review.create({
        data: {
          productId: product.id,
          userName: template.userName,
          petType: petTypeFromProduct,
          rating: template.rating,
          comment: template.comment,
        },
      })
    }
  }
  console.log('✅ Reviews created')

  // ==================== BANNERS ====================
  await db.$transaction([
    db.banner.create({
      data: {
        title: 'Sehatkan Hewan Kesayanganmu',
        subtitle: 'Marketplace vitamin & suplemen premium untuk kucing, anjing, dan hewan peliharaan lainnya.',
        imageUrl: 'https://placehold.co/1400x500/F97316/ffffff?text=Anima+Companion+Marketplace',
        link: '#/shop',
        position: 'HOME',
        order: 0,
        isActive: true,
      },
    }),
    db.banner.create({
      data: {
        title: 'Diskon 20% Pembelian Pertama',
        subtitle: 'Pakai kode HELLO20 di checkout. Berlaku untuk semua produk.',
        imageUrl: 'https://placehold.co/1400x300/7C3AED/ffffff?text=Promo+Spesial+%E2%80%94+Diskon+20%25',
        link: '#/shop',
        position: 'PROMO',
        order: 0,
        isActive: true,
      },
    }),
    db.banner.create({
      data: {
        title: 'Konsultasi Gratis via WhatsApp',
        subtitle: 'Bingung pilih produk yang tepat? Chat admin kami sekarang!',
        imageUrl: 'https://placehold.co/1400x200/22C55E/ffffff?text=Gratis+Konsultasi+%E2%80%94+WhatsApp+Sekarang',
        link: '#/kontak',
        position: 'HOME',
        order: 1,
        isActive: true,
      },
    }),
  ])
  console.log('✅ Banners created')

  // ==================== TESTIMONIALS ====================
  await db.$transaction([
    db.testimonial.create({
      data: {
        name: 'Sarah Wijaya',
        petName: 'Milo',
        petType: 'Kucing Persia',
        message: 'Anima Companion benar-benar solusi buat Milo yang sering pilek. Setelah pakai Immuno Plus rutin, jauh lebih sehat!',
        rating: 5,
        isActive: true,
      },
    }),
    db.testimonial.create({
      data: {
        name: 'Bayu Pratama',
        petName: 'Bruno',
        petType: 'Anjing Golden Retriever',
        message: 'Hip & Joint Advanced dari Zesty Paws bikin Bruno (9 tahun) bisa lari lagi seperti muda. Pengiriman cepat, admin juga helpful.',
        rating: 5,
        isActive: true,
      },
    }),
    db.testimonial.create({
      data: {
        name: 'Intan Permata',
        petName: 'Luna',
        petType: 'Kucing Maine Coon',
        message: 'Skin & Coat Omega Bites luar biasa. Bulu Luna jadi panjang dan mengkilap. Foto-fotonya jadi makin cakep!',
        rating: 5,
        isActive: true,
      },
    }),
    db.testimonial.create({
      data: {
        name: 'Doni Kurniawan',
        petName: 'Coco',
        petType: 'Anjing Pomeranian',
        message: 'Suka belanja di Anima Companion karena ada banyak brand premium. Packing rapi, produk asli, checkout via WhatsApp gampang.',
        rating: 5,
        isActive: true,
      },
    }),
  ])
  console.log('✅ Testimonials created')

  // ==================== VOUCHERS ====================
  await db.$transaction([
    db.voucher.create({
      data: {
        code: 'HELLO20',
        type: 'PERCENTAGE',
        value: 20,
        minSpend: 50000,
        isActive: true,
        description: 'Diskon 20% untuk pembelian pertama, min belanja Rp 50.000',
      },
    }),
    db.voucher.create({
      data: {
        code: 'HEMAT15',
        type: 'FIXED',
        value: 15000,
        minSpend: 100000,
        isActive: true,
        description: 'Potongan Rp 15.000 untuk pembelian min Rp 100.000',
      },
    }),
    db.voucher.create({
      data: {
        code: 'GRATISONGKIR',
        type: 'FIXED',
        value: 20000,
        minSpend: 75000,
        isActive: true,
        description: 'Potongan ongkir Rp 20.000 untuk pembelian min Rp 75.000',
      },
    }),
  ])
  console.log('✅ Vouchers created')

  // ==================== FAQs ====================
  await db.$transaction([
    db.fAQ.create({
      data: {
        question: 'Apakah produk Anima Companion sudah terdaftar BPOM?',
        answer: 'Ya, semua produk kami sudah terdaftar di BPOM dengan nomor registrasi yang tertera pada kemasan dan halaman produk.',
        order: 0,
        isActive: true,
      },
    }),
    db.fAQ.create({
      data: {
        question: 'Bagaimana cara pemesanan?',
        answer: 'Pilih produk yang diinginkan, masukkan ke keranjang, lalu checkout. Pesanan akan dikirim ke WhatsApp admin kami untuk konfirmasi pembayaran dan pengiriman.',
        order: 1,
        isActive: true,
      },
    }),
    db.fAQ.create({
      data: {
        question: 'Apakah tersedia konsultasi gratis?',
        answer: 'Ya! Tim kami siap membantu via WhatsApp untuk konsultasi seputar kesehatan hewan peliharaan dan pemilihan produk yang tepat.',
        order: 2,
        isActive: true,
      },
    }),
    db.fAQ.create({
      data: {
        question: 'Berapa lama waktu pengiriman?',
        answer: 'Untuk wilayah Jakarta 1-2 hari, dan luar Jakarta 2-4 hari kerja menggunakan ekspedisi JNE/JNT/SiCepat.',
        order: 3,
        isActive: true,
      },
    }),
  ])
  console.log('✅ FAQs created')

  // ==================== PET PROFILE untuk demo customer ====================
  const catType = petTypes.find((pt) => pt.slug === 'kucing')!
  await db.petProfile.create({
    data: {
      userId: customer.id,
      petName: 'Tommy',
      petTypeId: catType.id,
      age: '2 tahun',
      weight: '4.5 kg',
      notes: 'Kucing domestik, suka makan ikan',
    },
  })
  console.log('✅ Demo pet profile created')

  console.log('\n🎉 Seeding completed!')
  console.log('━━━━━━━━━━━━━━━━━━━━')
  console.log(`Sellers/Brands: ${sellers.length}`)
  console.log(`Products: ${productsData.length}`)
  console.log('Admin login:')
  console.log('  Email: admin@anima.id')
  console.log('  Password: admin123')
  console.log('')
  console.log('Customer login:')
  console.log('  Email: budi@example.com')
  console.log('  Password: customer123')
  console.log('━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
