// Sample seed content — 3 diseases, fully structured, to demonstrate the
// data model end-to-end. Add more via the admin API/UI once the app is running.
// Citations are illustrative placements (sthana/adhyaya) — please verify
// exact shloka numbers against your preferred edition before clinical use.

module.exports = [
  {
    slug: "pandu",
    sanskritName: "Pandu Roga",
    transliteration: "Pandu",
    commonName: { en: "Anemia / Pallor disease", hi: "पांडु रोग (रक्ताल्पता)" },
    synonyms: ["pandu roga", "panduroga", "anemia", "pallor"],
    doshaInvolvement: ["Pitta", "Vitiated Rasa-Rakta"],
    category: "Rasavaha & Raktavaha Vyadhi",
    reviewStatus: "published",

    nidana: [
      { text: "Excessive intake of Katu, Amla, Lavana rasa (pungent, sour, salty foods)", patientNote: "Eating too much spicy, sour, or salty food regularly" },
      { text: "Excess Ushna (heat-producing) and Teekshna (sharp) food/drink", patientNote: "Too much hot, oily, or irritating food" },
      { text: "Excess Divaswapna (day sleep) and Vyayama abhava (lack of exercise)", patientNote: "Sleeping too much in daytime and not exercising" },
      { text: "Chronic Agnimandya (weak digestion)", patientNote: "Long-standing weak digestion/appetite" },
    ],

    pathyaAhara: [
      { name: "Purana Shali (aged rice)", patientNote: "Old/aged rice is easier to digest and good for you", clinicalNote: "Laghu, easily digestible, supports Agni" },
      { name: "Mudga (green gram/moong dal)", patientNote: "Moong dal is light and nourishing", clinicalNote: "Laghu, Raktavardhaka" },
      { name: "Dadima (pomegranate)", patientNote: "Pomegranate helps build healthy blood", clinicalNote: "Raktavardhaka, Hridya" },
      { name: "Draksha (raisins/grapes)", patientNote: "Raisins are a good daily snack for you" },
      { name: "Godhuma (wheat, well-cooked)", patientNote: "Well-cooked wheat preparations are fine" },
      { name: "Cow's ghee (in moderation)", patientNote: "A small amount of cow ghee daily helps digestion", conditionalNote: "Avoid excess if Kapha is also aggravated" },
    ],

    apathyaAhara: [
      { name: "Katu-Amla-Lavana atisevana (excess pungent-sour-salty food)", patientNote: "Avoid too much spicy, sour, or salty food" },
      { name: "Madya (alcohol)", patientNote: "Avoid alcohol completely" },
      { name: "Guru, Abhishyandi foods (heavy, congestive foods e.g. excess dairy, fried food)", patientNote: "Avoid heavy fried food and excess dairy" },
      { name: "Kulattha (horse gram) in excess", patientNote: "Don't overuse horse gram" },
      { name: "Stale/reheated food", patientNote: "Avoid stale or repeatedly reheated food" },
    ],

    pathyaVihara: [
      { name: "Regular mild Vyayama (exercise)", patientNote: "Do light daily exercise like walking" },
      { name: "Adequate sleep at proper time", patientNote: "Sleep on time, don't stay up too late" },
      { name: "Sunlight exposure in moderation", patientNote: "Get some morning sunlight" },
    ],

    apathyaVihara: [
      { name: "Divaswapna (day-time sleep)", patientNote: "Avoid sleeping during the day" },
      { name: "Ativyayama (excessive exercise)", patientNote: "Don't overexert with heavy exercise" },
      { name: "Krodha, Chinta (anger, excess mental stress)", patientNote: "Try to avoid excess stress and anger" },
      { name: "Ratri Jagarana (staying up late at night)", patientNote: "Avoid staying awake late into the night" },
    ],

    dinacharya: [
      { timeOfDay: "Early Morning", activity: "Ushapana (warm water) and mild movement", clinicalNote: "Supports Agni, avoids Kapha stagnation", patientNote: "Drink a glass of warm water after waking up" },
      { timeOfDay: "Morning", activity: "Light Vyayama, Abhyanga (oil massage) if tolerated", patientNote: "Light exercise; oil massage if your doctor approves" },
      { timeOfDay: "Afternoon", activity: "Main meal, avoid heavy/fried food", patientNote: "Eat your main meal here, keep it light and nutritious" },
      { timeOfDay: "Evening", activity: "Light walk, avoid daytime sleep earlier", patientNote: "A short walk is good" },
      { timeOfDay: "Night", activity: "Early, light dinner; sleep by 10 pm", patientNote: "Eat an early light dinner and sleep on time" },
    ],

    ritucharya: [
      { season: "Varsha", modification: "Extra care with Agni, favor light warm freshly-cooked food", patientNote: "In the monsoon, eat only fresh, warm, light food" },
      { season: "Grishma", modification: "Avoid excess Ushna/Teekshna dravya even though generally advised in small amount", patientNote: "In summer, go easy on spicy/hot food even more than usual" },
      { season: "Hemanta", modification: "Nourishing, warm, unctuous food acceptable in moderation", patientNote: "In winter, warm nourishing food in moderate amounts is fine" },
    ],

    precautions: [
      "Persistent breathlessness, chest pain, or fainting needs urgent medical evaluation — do not manage with diet alone.",
      "Pandu in pregnancy or in children needs specialist supervision.",
      "Rule out underlying causes (bleeding, nutritional deficiency, chronic disease) alongside Ayurvedic management.",
    ],

    patientEducation: [
      { text: "Pandu roga is broadly similar to what is called anemia/low blood count in modern medicine.", category: "general" },
      { text: "Diet changes support recovery but do not replace your doctor's full treatment plan — please continue as advised.", category: "warning" },
      { text: "Eating iron-rich or blood-building foods alone is not enough if digestion (Agni) stays weak — both matter together.", category: "myth-busting" },
    ],

    citations: [
      { granth: "Charaka Samhita", sthana: "Chikitsa Sthana", adhyaya: "16", shlokaNumber: "ref. Panduroga Chikitsa", translation: "Describes Nidana, Samprapti and dietary management of Pandu Roga." },
      { granth: "Sushruta Samhita", sthana: "Uttara Tantra", adhyaya: "44", shlokaNumber: "ref. Panduroga Adhyaya", translation: "Describes classification and management of Pandu." },
      { granth: "Ashtanga Hridaya", sthana: "Chikitsa Sthana", adhyaya: "16", shlokaNumber: "ref. Pandu-Kamala Chikitsa", translation: "Describes Pathya-Apathya for Pandu and related Kamala." },
    ],
  },

  {
    slug: "amavata",
    sanskritName: "Amavata",
    transliteration: "Amavata",
    commonName: { en: "Rheumatoid arthritis (Ama-type joint disease)", hi: "आमवात" },
    synonyms: ["amavata", "ama vata", "rheumatoid arthritis", "joint pain ama"],
    doshaInvolvement: ["Vata", "Kapha", "Ama"],
    category: "Sandhigata Vyadhi",
    reviewStatus: "published",

    nidana: [
      { text: "Viruddha Ahara (incompatible food combinations)", patientNote: "Eating food combinations that don't go well together, e.g. milk with fish/sour fruits" },
      { text: "Vyayama immediately after excess heavy food (Snigdha Bhojanottara Vyayama)", patientNote: "Exercising right after a heavy meal" },
      { text: "Manda Agni (weak digestive fire) leading to Ama formation", patientNote: "Long-term weak digestion creating toxins (Ama)" },
    ],

    pathyaAhara: [
      { name: "Old rice (Purana Shali), light khichari", patientNote: "Light khichdi and old rice are easy on digestion" },
      { name: "Mudga (moong dal) soup", patientNote: "Moong dal soup is a good, light protein source" },
      { name: "Warm water throughout the day", patientNote: "Sip warm water through the day" },
      { name: "Ginger (Shunthi) in cooking", patientNote: "Add ginger to your food to help digestion" },
    ],

    apathyaAhara: [
      { name: "Curd (Dadhi), especially at night", patientNote: "Avoid curd, especially in the evening/night" },
      { name: "Viruddha Ahara combinations", patientNote: "Avoid incompatible food combos like milk with sour fruit or fish" },
      { name: "Cold, heavy, oily, fried food", patientNote: "Avoid cold drinks, heavy fried, and oily food" },
      { name: "Black gram (Urad dal) in excess", patientNote: "Limit urad dal" },
    ],

    pathyaVihara: [
      { name: "Langhana (light fasting) during acute flare guided by physician", patientNote: "Your doctor may advise a light-eating day during a flare-up" },
      { name: "Gentle joint movement once acute pain settles", patientNote: "Gentle movement once the sharp pain has eased" },
    ],

    apathyaVihara: [
      { name: "Vyayama during active Ama stage", patientNote: "Avoid heavy exercise during a flare-up" },
      { name: "Diwaswapna (day sleep)", patientNote: "Avoid sleeping during the day" },
      { name: "Exposure to cold, damp environments", patientNote: "Keep joints warm; avoid cold and damp weather exposure" },
    ],

    dinacharya: [
      { timeOfDay: "Morning", activity: "Warm water, light stretching once pain-free window allows", patientNote: "Warm water on waking; gentle stretching only if not painful" },
      { timeOfDay: "Afternoon", activity: "Main light meal, avoid daytime sleep after", patientNote: "Eat your main light meal; don't nap right after" },
      { timeOfDay: "Night", activity: "Light early dinner, avoid curd/heavy food", patientNote: "Keep dinner light and early, skip curd" },
    ],

    ritucharya: [
      { season: "Varsha", modification: "Extra caution — Vata-Kapha aggravating season for this condition", patientNote: "Monsoon can worsen joint pain — keep extra warm and dry" },
      { season: "Shishira", modification: "Keep joints warm, favor Ushna (warm) therapies", patientNote: "In late winter, keep joints warm and covered" },
    ],

    precautions: [
      "Sudden severe joint swelling with fever needs prompt medical evaluation.",
      "Ama-stage dietary restriction should be guided by a qualified Ayurvedic physician, not self-prescribed long-term fasting.",
    ],

    patientEducation: [
      { text: "Amavata is driven by both weak digestion (Ama formation) and Vata aggravation — diet addresses the root, not just the joint symptom.", category: "general" },
      { text: "Avoiding curd and incompatible food combinations is a classical recommendation specific to this condition, not a general rule for everyone.", category: "myth-busting" },
    ],

    citations: [
      { granth: "Madhava Nidana", sthana: "Nidana Sthana", adhyaya: "25", shlokaNumber: "ref. Amavata Nidana", translation: "Classical description of Amavata etiology and features." },
      { granth: "Chakradatta", sthana: "Chikitsa", adhyaya: "ref. Amavata Chikitsa", shlokaNumber: "-", translation: "Management principles including Langhana and diet for Amavata." },
    ],
  },

  {
    slug: "jwara",
    sanskritName: "Jwara",
    transliteration: "Jwara",
    commonName: { en: "Fever", hi: "ज्वर (बुखार)" },
    synonyms: ["jwara", "jvara", "fever"],
    doshaInvolvement: ["Tridosha (variable predominance)"],
    category: "Sarvaroga Purvarupa / Jwara Roga",
    reviewStatus: "published",

    nidana: [
      { text: "Ritu Viparyaya (unseasonal exposure), Ajeerna Bhojana (eating without proper digestion of previous meal)", patientNote: "Sudden weather exposure and eating before your last meal is digested" },
      { text: "Manasika Bhava (excess mental stress/emotional disturbance)", patientNote: "High mental stress or emotional upset" },
    ],

    pathyaAhara: [
      { name: "Langhana (light fasting) in initial stage as advised by physician", patientNote: "Your doctor may advise eating very little in the first day or two" },
      { name: "Peya/Manda (thin rice gruel)", patientNote: "Thin rice gruel/soup is ideal once you can eat" },
      { name: "Warm water with a little ginger", patientNote: "Warm ginger water helps" },
    ],

    apathyaAhara: [
      { name: "Guru, Snigdha Ahara (heavy, oily food)", patientNote: "Avoid heavy, oily, or fried food" },
      { name: "Cold food and drinks", patientNote: "Avoid cold food/drinks" },
      { name: "Overeating even after fever subsides (Punarjwara risk)", patientNote: "Don't overeat right after fever goes down — reintroduce food gradually" },
    ],

    pathyaVihara: [
      { name: "Complete rest during acute fever", patientNote: "Rest completely while fever is active" },
      { name: "Sponging with lukewarm water if advised", patientNote: "Lukewarm sponging can help if your doctor suggests it" },
    ],

    apathyaVihara: [
      { name: "Vyayama (exercise) during fever", patientNote: "No exercise while feverish" },
      { name: "Snana with cold water during high fever without guidance", patientNote: "Avoid cold water bathing during high fever unless guided" },
      { name: "Divaswapna against physician's advice", patientNote: "Avoid daytime sleep unless your doctor says it's fine" },
    ],

    dinacharya: [
      { timeOfDay: "Throughout the day", activity: "Rest, small sips of warm fluids, monitor temperature", patientNote: "Rest, sip warm fluids often, and keep checking your temperature" },
    ],

    ritucharya: [
      { season: "Varsha", modification: "High Jwara incidence season — extra care with food hygiene and Agni", patientNote: "Monsoon is a common fever season — be extra careful with food and water hygiene" },
    ],

    precautions: [
      "High-grade fever (above 103°F/39.4°C), fever beyond 3 days, or fever with rash, severe headache, breathlessness, or altered consciousness needs urgent medical evaluation.",
      "Fasting/Langhana protocols must be individualized by a physician, especially in children, elderly, and pregnancy.",
    ],

    patientEducation: [
      { text: "In classical Ayurveda, controlled light eating (Langhana) during fever is meant to support digestion, not to starve the body — always follow your doctor's specific guidance on how much and how long.", category: "myth-busting" },
      { text: "Fever is treated as a process to be supported correctly, not just suppressed quickly.", category: "general" },
    ],

    citations: [
      { granth: "Charaka Samhita", sthana: "Chikitsa Sthana", adhyaya: "3", shlokaNumber: "ref. Jwara Chikitsa", translation: "Extensive description of Jwara types, stages, and management including Langhana." },
      { granth: "Madhava Nidana", sthana: "Nidana Sthana", adhyaya: "2", shlokaNumber: "ref. Jwara Nidana", translation: "Classical causative factors and classification of Jwara." },
    ],
  },
];
