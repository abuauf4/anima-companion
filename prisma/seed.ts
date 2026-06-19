import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

// ============================================================================
// Anima Companion — Real Brand Seed
// Brand: Anima Companion (PT Sutan Vet Medika, Bogor, Jawa Barat, Indonesia)
// Tagline: "Elevating Animal Health" / "Suplemen Rekomendasi drh."
// Hashtag: #PawrentHebatAnabulSehat
// Distribution: 515+ klinik hewan seluruh Indonesia
// Marketplace: Shopee, Tokopedia, TikTok Shop
// ============================================================================
// NOTE: All BPOM numbers below are PLACEHOLDERS that need to be verified
// directly with PT Sutan Vet Medika before production use.
// Search for "// TODO: verify with PT Sutan Vet Medika" comments below.
// ============================================================================

async function main() {
  console.log('🌱 Seeding Anima Companion — Real Brand Edition (PT Sutan Vet Medika, Bogor)...')

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
  await db.seller.deleteMany()       // Seller table kept for backward compat — not seeded (single-brand now)
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

  // ============================================================================
  // NO SELLERS / BRANDS SECTION
  // Anima Companion is a SINGLE-BRAND store (PT Sutan Vet Medika).
  // The Seller table is kept in schema.prisma for backward compatibility,
  // but we no longer seed any seller rows. Products are not linked to sellers.
  // ============================================================================

  // ==================== PRODUCTS (8 real Anima Companion products) ====================
  const img = (label: string, color: string, idx: number) =>
    `https://placehold.co/600x600/${color}/ffffff?text=${encodeURIComponent(label + ' ' + (idx + 1))}`

  interface ProductSeed {
    name: string
    slug: string
    sku: string
    brand: string
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
    bpomNumber: string | null
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
    // ============ LINE 1: FELCOVER+ (Immune Stimulant line) ============
    {
      name: 'Felcover+ Immune Stimulant',
      slug: 'felcover-plus-immune-stimulant',
      sku: 'AC-FEL-001',
      brand: 'Anima Companion',
      price: 240000,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 45,
      weight: '30 kapsul',
      description:
        'Felcover+ adalah suplemen immune stimulant yang dirancang khusus untuk hewan kesayangan yaitu kucing dan anjing. Produk mengandung kolostrum dan prebiotik yang membantu meningkatkan daya tahan tubuh dan menjaga kesehatan pencernaan anabul.',
      benefit:
        'Meningkatkan daya tahan tubuh, membantu menjaga kesehatan pencernaan, mencegah diare, flu, dan virus. Rekomendasi dokter hewan untuk pemulihan setelah sakit.',
      usage:
        'Kucing: 1 kapsul sehari (isi bubuk ditabur ke makanan).\nAnjing kecil (<10kg): 1 kapsul sehari.\nAnjing besar (>10kg): 2 kapsul sehari.\nDiberikan setelah makan.',
      ingredients:
        'Kolostrum, Prebiotik, Lactobacillus, Vitamin B Kompleks, Vitamin E, Selenium.',
      // TODO: verify with PT Sutan Vet Medika
      bpomNumber: 'BPOM TR 231234567001',
      isBestSeller: true,
      isNew: false,
      rating: 4.9,
      reviewCount: 89,
      categorySlug: 'suplemen',
      problemSlugs: ['imunitas', 'recovery'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: '3B82F6',
    },

    // ============ LINE 2: SIOREN (Cat Supplement line — 6 variants) ============
    {
      name: 'Sioren Cat Supplement — Nafsu Makan',
      slug: 'sioren-nafsu-makan',
      sku: 'AC-SIO-002',
      brand: 'Anima Companion',
      price: 9500,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 200,
      weight: 'per kapsul',
      description:
        'Sioren adalah vitamin nafsu makan untuk kucing dan anjing yang dijual per kapsul. Diformulasi khusus untuk hewan yang susah makan, picky eater, atau dalam masa pemulihan. Praktis karena bisa dibeli sesuai kebutuhan.',
      benefit:
        'Meningkatkan nafsu makan, memperkuat imunitas, menurunkan risiko infeksi, membantu hewan makan lebih lahap dan teratur.',
      usage:
        'Kucing & anjing kecil: 1 kapsul sehari (isi ditabur ke makanan).\nAnjing besar: 2 kapsul sehari.\nDiberikan saat makan.',
      ingredients:
        'Vitamin B Kompleks, L-Lysine, Ekstrak Herbal, Taurine.',
      // TODO: verify with PT Sutan Vet Medika
      bpomNumber: 'BPOM TR 231234567002',
      isBestSeller: true,
      isNew: false,
      rating: 4.8,
      reviewCount: 156,
      categorySlug: 'suplemen',
      problemSlugs: ['nafsu-makan'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: 'F59E0B',
    },
    {
      name: 'Sioren Fish Oil',
      slug: 'sioren-fish-oil',
      sku: 'AC-SIO-003',
      brand: 'Anima Companion',
      price: 75000,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 60,
      weight: '60 ml',
      description:
        'Sioren Fish Oil adalah minyak ikan murni kaya Omega 3 (EPA & DHA) untuk kucing dan anjing. Membantu menjaga kesehatan bulu agar lebat, mengkilap, dan mengurangi rontok. Juga berfungsi sebagai penambah nafsu makan alami.',
      benefit:
        'Bulu lebih lebat dan mengkilap, mengurangi rontok, menjaga kesehatan kulit, mendukung perkembangan otak dan jantung, serta menambah nafsu makan alami.',
      usage:
        'Kucing: 1-2 ml per hari dicampur makanan.\nAnjing kecil: 2-3 ml per hari.\nAnjing besar: 5 ml per hari.\nDapat diberikan langsung atau dicampur ke makanan.',
      ingredients:
        'Wild Fish Oil 99% (EPA 18%, DHA 12%), Vitamin E sebagai antioksidan.',
      // TODO: verify with PT Sutan Vet Medika
      bpomNumber: 'BPOM TR 231234567003',
      isBestSeller: true,
      isNew: false,
      rating: 4.9,
      reviewCount: 78,
      categorySlug: 'suplemen',
      problemSlugs: ['bulu-dan-kulit', 'harian'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: '06B6D4',
    },
    {
      name: 'Sioren Booster+',
      slug: 'sioren-booster-plus',
      sku: 'AC-SIO-004',
      brand: 'Anima Companion',
      price: 45000,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 50,
      weight: '30 sachet',
      description:
        'Sioren Booster+ adalah suplemen penambah energi dan nafsu makan dalam format serbuk (sachet). Tinggal tabur di atas snack atau makanan. Membantu pemulihan lebih cepat setelah sakit atau operasi, dan menambah nafsu makan dengan cepat.',
      benefit:
        'Pemulihan lebih cepat, nafsu makan meningkat drastis, menambah energi, menjaga daya tahan tubuh. Praktis karena format serbuk tinggal ditabur.',
      usage:
        'Kucing & anjing kecil: 1 sachet sehari ditabur di makanan.\nAnjing besar: 2 sachet sehari.\nAromanya membuat anabul lahap makan.',
      ingredients:
        'Vitamin B Kompleks, L-Carnitine, Ekstrak Herbal, Taurine, Prebiotik.',
      // TODO: verify with PT Sutan Vet Medika
      bpomNumber: 'BPOM TR 231234567004',
      isBestSeller: false,
      isNew: true,
      rating: 4.8,
      reviewCount: 64,
      categorySlug: 'suplemen',
      problemSlugs: ['nafsu-makan', 'recovery'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: '22C55E',
    },
    {
      name: 'Sioren Pet Odor X',
      slug: 'sioren-pet-odor-x',
      sku: 'AC-SIO-005',
      brand: 'Anima Companion',
      price: 32000,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 70,
      weight: '200 gram',
      description:
        'Sioren Pet Odor X adalah serbuk anti-bau untuk litterbox dan area kandang hewan. Mengandung active charcoal dan natural absorbent yang menyerap bau ammonia dan kelembaban. Tersedia di 515+ klinik seluruh Indonesia.',
      benefit:
        'Menghilangkan bau litterbox hingga 24 jam, menyerap kelembaban, mencegah bakteri, aman dipakai sehari-hari.',
      usage:
        'Taburkan secukupnya di dasar litterbox sebelum pasang pasir, atau tabur di atas pasir setelah dibersihkan. Bisa juga ditabur di area kandang.',
      ingredients:
        'Active Charcoal, Natural Absorbent, Sodium Bicarbonate, Fragrance-free.',
      // Tidak terdaftar BPOM — alat/perawatan, bukan suplemen
      bpomNumber: null,
      isBestSeller: false,
      isNew: false,
      rating: 4.7,
      reviewCount: 92,
      categorySlug: 'perawatan',
      problemSlugs: ['harian'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: '475569',
    },
    {
      name: 'Sioren Skin & Coat',
      slug: 'sioren-skin-coat',
      sku: 'AC-SIO-006',
      brand: 'Anima Companion',
      price: 65000,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 55,
      weight: '30 sachet',
      description:
        'Sioren Skin & Coat adalah suplemen untuk kesehatan kulit dan bulu kucing dan anjing. Membantu menjaga kulit tetap sehat dan bulu lebat, mengkilap, serta bebas masalah kulit seperti gatal dan ketombe.',
      benefit:
        'Kulit sehat, bulu lebat dan mengkilap, mengurangi gatal dan ketombe, mencegah bulu rontok.',
      usage:
        'Kucing & anjing kecil: 1 sachet sehari.\nAnjing besar: 2 sachet sehari.\nDitabur di atas makanan.',
      ingredients:
        'Omega 3, Omega 6, Biotin, Zinc, Vitamin E.',
      // TODO: verify with PT Sutan Vet Medika
      bpomNumber: 'BPOM TR 231234567005',
      isBestSeller: false,
      isNew: true,
      rating: 4.8,
      reviewCount: 47,
      categorySlug: 'suplemen',
      problemSlugs: ['bulu-dan-kulit'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: 'EC4899',
    },
    {
      name: 'Sioren Flu Support+',
      slug: 'sioren-flu-support-plus',
      sku: 'AC-SIO-007',
      brand: 'Anima Companion',
      price: 18500,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 80,
      weight: '15 ml',
      description:
        'Sioren Flu Support+ adalah obat flu dan pilek untuk kucing dan anjing. Membantu meredakan gejala flu, pilek, bersin, dan hidung tersumbat. Memperkuat daya tahan tubuh secara alami.',
      benefit:
        'Meredakan flu dan pilek, mengurangi bersin, melegakan hidung tersumbat, memperkuat daya tahan tubuh.',
      usage:
        'Kucing: 0.5 ml 2x sehari.\nAnjing kecil: 1 ml 2x sehari.\nAnjing besar: 2 ml 2x sehari.\nDiberikan langsung atau dicampur makanan.',
      ingredients:
        'L-Lysine, Vitamin C, Echinacea Extract, Zinc.',
      // TODO: verify with PT Sutan Vet Medika
      bpomNumber: 'BPOM TR 231234567006',
      isBestSeller: false,
      isNew: false,
      rating: 4.7,
      reviewCount: 38,
      categorySlug: 'suplemen',
      problemSlugs: ['imunitas', 'recovery'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: 'EF4444',
    },

    // ============ LINE 3: FOREVET (Stress Management line) ============
    {
      name: 'Forevet Stress Manajemen',
      slug: 'forevet-stress-manajemen',
      sku: 'AC-FOR-008',
      brand: 'Anima Companion',
      price: 85000,
      salePrice: null,
      subscribePrice: null,
      isSubscribeEligible: false,
      stock: 40,
      weight: '30 kapsul',
      description:
        'Forevet adalah suplemen stress management untuk kucing dan anjing. Mengandung alpha-casozepine yang diperoleh dari protein susu dan membantu menenangkan sistem saraf hewan. Cocok untuk hewan yang stres saat ditinggal pemilik, perjalanan, atau kunjungan ke dokter.',
      benefit:
        'Menenangkan sistem saraf, mengurangi stres saat ditinggal, membantu hewan lebih tenang saat perjalanan atau ke dokter, memperbaiki kualitas tidur.',
      usage:
        'Kucing & anjing kecil: 1 kapsul sehari.\nAnjing besar: 2 kapsul sehari.\nDiberikan 1 jam sebelum situasi stres, atau rutin setiap hari.',
      ingredients:
        'Alpha-Casozepine (protein susu), L-Tryptophan, Vitamin B6, Magnesium.',
      // TODO: verify with PT Sutan Vet Medika
      bpomNumber: 'BPOM TR 231234567007',
      isBestSeller: false,
      isNew: true,
      rating: 4.8,
      reviewCount: 52,
      categorySlug: 'suplemen',
      problemSlugs: ['harian'],
      petTypeSlugs: ['kucing', 'anjing'],
      color: '8B5CF6',
    },
  ]

  for (const p of productsData) {
    const category = categories.find((c) => c.slug === p.categorySlug)!
    const product = await db.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        brand: p.brand,
        // sellerId intentionally omitted — single-brand store, products are not linked to sellers
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
    console.log(`✅ Product created: ${product.name}`)
  }

  // ==================== REVIEWS ====================
  // 12 reviews distributed across 8 products:
  // - Top sellers (Felcover+, Sioren Nafsu Makan, Sioren Fish Oil, Sioren Skin & Coat): 2 reviews each
  // - Others (Sioren Booster+, Sioren Pet Odor X, Sioren Flu Support+, Forevet): 1 review each
  // Total: 4*2 + 4*1 = 12 reviews
  const allProducts = await db.product.findMany({
    select: { id: true, slug: true, petTypes: { include: { petType: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // 12 review templates — each tagged with the product slug it's meant for (for clarity)
  const reviewTemplates: { productSlug: string; userName: string; petType: string; rating: number; comment: string }[] = [
    // Felcover+ Immune Stimulant (2 reviews)
    {
      productSlug: 'felcover-plus-immune-stimulant',
      userName: 'Sarah Wijaya',
      petType: 'Kucing',
      rating: 5,
      comment: 'Milo (Persia) saya sering pilek dan diare. Setelah rutin pakai Felcover+ dari Anima Companion, jauh lebih sehat. Rekomendasi dokter hewan klinik saya.',
    },
    {
      productSlug: 'felcover-plus-immune-stimulant',
      userName: 'Andi Suryono',
      petType: 'Anjing',
      rating: 5,
      comment: 'Anjing saya habis operasi, dokter recommend Felcover+ untuk recovery. Daya tahan tubuhnya balik cepat, aroma kolostrumnya disukai anabul.',
    },

    // Sioren Nafsu Makan (2 reviews)
    {
      productSlug: 'sioren-nafsu-makan',
      userName: 'Ratna Dewi',
      petType: 'Kucing',
      rating: 5,
      comment: 'Kucing persian saya picky eater banget. Setelah ditabur Sioren, langsung lahap. Beli per kapsul juga praktis sesuai kebutuhan.',
    },
    {
      productSlug: 'sioren-nafsu-makan',
      userName: 'Hendra Wijaya',
      petType: 'Anjing',
      rating: 4,
      comment: 'Anjing saya habis sakit gak mau makan, pakai Sioren langsung makan lagi. Harga per kapsulnya terjangkau banget.',
    },

    // Sioren Fish Oil (2 reviews)
    {
      productSlug: 'sioren-fish-oil',
      userName: 'Bayu Pratama',
      petType: 'Anjing',
      rating: 5,
      comment: 'Bulu Bruno (Golden Retriever) jadi lebih mengkilap dan rontok berkurang setelah 3 minggu pakai Sioren Fish Oil. Recommended banget!',
    },
    {
      productSlug: 'sioren-fish-oil',
      userName: 'Citra Lestari',
      petType: 'Kucing',
      rating: 5,
      comment: 'Fish oilnya premium, aromanya ikan segar. Bulu Maine Coon saya jadi tebal dan halus, gak gampang rontok.',
    },

    // Sioren Booster+ (1 review)
    {
      productSlug: 'sioren-booster-plus',
      userName: 'Intan Permata',
      petType: 'Kucing',
      rating: 5,
      comment: 'Luna habis operasi dan gak mau makan. Sioren Booster+ langsung bikin dia lahap lagi. Pemulihan cepat, tinggal tabur di makanan.',
    },

    // Sioren Pet Odor X (1 review)
    {
      productSlug: 'sioren-pet-odor-x',
      userName: 'Dewi Anggraini',
      petType: 'Kucing',
      rating: 4,
      comment: 'Litterbox 3 kucing saya jadi gak bau sama sekali. Pet Odor X benar-benar ampuh menyerap bau ammonia, tahan sampai 24 jam.',
    },

    // Sioren Skin & Coat (2 reviews)
    {
      productSlug: 'sioren-skin-coat',
      userName: 'Maya Safira',
      petType: 'Kucing',
      rating: 5,
      comment: 'Kucing saya ada masalah kulit gatal dan ketombe. Setelah 1 bulan pakai Skin & Coat, kulitnya sehat dan bulu mengkilap. Mantap!',
    },
    {
      productSlug: 'sioren-skin-coat',
      userName: 'Reza Aditama',
      petType: 'Anjing',
      rating: 4,
      comment: 'Bulu anjing saya rontok parah. Pakai Sioren Skin & Coat rutin, rontok berkurang signifikan. Format sachet praktis.',
    },

    // Sioren Flu Support+ (1 review)
    {
      productSlug: 'sioren-flu-support-plus',
      userName: 'Lia Marlina',
      petType: 'Kucing',
      rating: 5,
      comment: 'Kucing saya flu dan pilek parah. Flu Support+ bantu meredakan bersin dalam 3 hari. Wajib stok di rumah untuk anabul.',
    },

    // Forevet Stress Manajemen (1 review)
    {
      productSlug: 'forevet-stress-manajemen',
      userName: 'Doni Kurniawan',
      petType: 'Anjing',
      rating: 5,
      comment: 'Coco (Pomeranian) stres tiap ditinggal pergi. Forevet bantu banget, sekarang lebih tenang dan gak merusak barang lagi.',
    },
  ]

  let reviewCountCreated = 0
  for (const template of reviewTemplates) {
    const product = allProducts.find((p) => p.slug === template.productSlug)
    if (!product) {
      console.warn(`⚠️  Product not found for review: ${template.productSlug}`)
      continue
    }
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
    reviewCountCreated++
  }
  console.log(`✅ Reviews created: ${reviewCountCreated}`)

  // ==================== BANNERS ====================
  await db.$transaction([
    db.banner.create({
      data: {
        title: 'Elevating Animal Health',
        subtitle: 'Suplemen hewan peliharaan rekomendasi dokter hewan. Tersedia di 515+ klinik seluruh Indonesia.',
        imageUrl: 'https://placehold.co/1400x500/3B82F6/ffffff?text=Anima+Companion+%E2%80%94+Elevating+Animal+Health',
        link: '#/shop',
        position: 'HOME',
        order: 0,
        isActive: true,
      },
    }),
    db.banner.create({
      data: {
        title: 'Felcover+ — Immune Stimulant Andalan',
        subtitle: 'Meningkatkan daya tahan tubuh kucing & anjing. Rekomendasi dokter hewan.',
        imageUrl: 'https://placehold.co/1400x300/22C55E/ffffff?text=Felcover%2B+Immune+Stimulant',
        link: '#/product/felcover-plus-immune-stimulant',
        position: 'PROMO',
        order: 0,
        isActive: true,
      },
    }),
    db.banner.create({
      data: {
        title: 'Konsultasi Gratis via WhatsApp',
        subtitle: 'Bingung pilih suplemen yang tepat untuk anabul? Chat admin kami sekarang!',
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
        message: 'Milo sering pilek dan diare. Setelah rutin pakai Felcover+ dari Anima Companion, jauh lebih sehat. Rekomendasi dokter hewan klinik saya.',
        rating: 5,
        isActive: true,
      },
    }),
    db.testimonial.create({
      data: {
        name: 'Bayu Pratama',
        petName: 'Bruno',
        petType: 'Anjing Golden Retriever',
        message: 'Bulu Bruno jadi lebih mengkilap dan rontok berkurang setelah 3 minggu pakai Sioren Fish Oil. Recommended banget!',
        rating: 5,
        isActive: true,
      },
    }),
    db.testimonial.create({
      data: {
        name: 'Intan Permata',
        petName: 'Luna',
        petType: 'Kucing Maine Coon',
        message: 'Luna habis operasi dan gak mau makan. Sioren Booster+ langsung bikin dia lahap lagi. Pemulihan cepat!',
        rating: 5,
        isActive: true,
      },
    }),
    db.testimonial.create({
      data: {
        name: 'Doni Kurniawan',
        petName: 'Coco',
        petType: 'Anjing Pomeranian',
        message: 'Coco stres tiap ditinggal pergi. Forevet bantu banget, sekarang lebih tenang dan gak merusak barang lagi.',
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
        answer: 'Ya, semua produk suplemen kami sudah terdaftar di BPOM dengan nomor registrasi yang tertera pada kemasan dan halaman produk. Produk alat/perawatan tertentu seperti Pet Odor X tidak wajib BPOM karena bukan suplemen.',
        order: 0,
        isActive: true,
      },
    }),
    db.fAQ.create({
      data: {
        question: 'Bagaimana cara pemesanan?',
        answer: 'Pilih produk yang diinginkan, masukkan ke keranjang, lalu checkout. Pesanan akan dikirim ke WhatsApp admin kami untuk konfirmasi pembayaran dan pengiriman. Tersedia juga di Shopee, Tokopedia, dan TikTok Shop.',
        order: 1,
        isActive: true,
      },
    }),
    db.fAQ.create({
      data: {
        question: 'Apakah tersedia konsultasi gratis?',
        answer: 'Ya! Tim kami siap membantu via WhatsApp untuk konsultasi seputar kesehatan hewan peliharaan dan pemilihan produk yang tepat. Produk kami juga direkomendasikan oleh dokter hewan di 515+ klinik seluruh Indonesia.',
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
