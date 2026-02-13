const fs = require("fs");

const COOKIE_FILE = "/tmp/nk.txt";
const BASE = "https://niseko-gazet.vercel.app";

function getCookies() {
  const txt = fs.readFileSync(COOKIE_FILE, "utf8");
  const cookies = [];
  for (let line of txt.split("\n")) {
    line = line.replace(/^#HttpOnly_/, "");
    if (line.startsWith("#") || !line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length >= 7) cookies.push(parts[5] + "=" + parts[6]);
  }
  return cookies.join("; ");
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Cookie: getCookies() },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const stories = [
  {
    headline: "Record Snowfall Blankets Niseko: 45cm Overnight Dumps Powder Paradise",
    summary:
      "Niseko Grand Hirafu recorded 45 centimeters of fresh powder overnight, marking the heaviest single-night snowfall of the 2025-26 season. Ski patrol reports excellent conditions across all four interconnected resorts.",
    topicTags: ["powder-report", "breaking"],
    geoTags: ["niseko", "hirafu"],
    isGated: false,
    contentBlocks: [
      {
        type: "text",
        content:
          "Niseko Grand Hirafu woke to a winter wonderland this morning as 45 centimeters of fresh Hokkaido champagne powder blanketed the mountain overnight. The dump, driven by a strong Siberian cold front pushing across the Sea of Japan, marks the heaviest single-night snowfall of the 2025-26 season.",
      },
      {
        type: "text",
        content:
          'Ski patrol teams were out by 5:30 AM grooming runs and conducting avalanche control work. By the time lifts opened at 8:30 AM, lines at the Hirafu Gondola stretched past the ticket office \u2014 a sight that veteran locals say rivals the legendary dumps of January 2016.',
      },
      {
        type: "text",
        content:
          '"This is what people travel halfway around the world for," said Takeshi Yamamoto, head of ski patrol at Grand Hirafu. "The snow quality is exceptional \u2014 dry, light, and bottomless in the bowls. We\u2019re recommending advanced skiers head to the Gate 3 backcountry access for the best turns."',
      },
      {
        type: "text",
        content:
          "All four Niseko United resorts \u2014 Grand Hirafu, Hanazono, Niseko Village, and Annupuri \u2014 report a current base depth exceeding 340 centimeters at summit level. The Japan Meteorological Agency forecasts continued snowfall through Thursday, with an additional 20-30cm expected.",
      },
      {
        type: "text",
        content:
          "Road conditions on Route 343 between Kutchan and Hirafu are classified as winter-packed. Niseko Bus services are operating on snow schedule with 15-minute delays. Drivers are advised to carry chains and allow extra travel time.",
      },
    ],
    sourceLog: [
      {
        source: "Niseko Grand Hirafu Ski Patrol",
        verified: true,
        notes: "Official snow report confirmed",
      },
    ],
    riskFlags: [],
  },
  {
    headline:
      "Kutchan Town Council Approves New International School for 2027 Opening",
    summary:
      "The Kutchan Town Council has unanimously approved plans for a new international school campus near Niseko Station, addressing growing demand from the region\u2019s expanding expatriate community.",
    topicTags: ["community", "education"],
    geoTags: ["kutchan", "niseko"],
    isGated: false,
    contentBlocks: [
      {
        type: "text",
        content:
          "In a landmark decision for the Niseko region, Kutchan Town Council voted unanimously on Tuesday to approve construction of the Niseko International Academy, a K-12 school set to open its doors in April 2027.",
      },
      {
        type: "text",
        content:
          "The 8,500-square-meter campus will be built on a 2.3-hectare site adjacent to Niseko Station, selected for its accessibility by both rail and the proposed new shuttle bus network. The project, backed by a consortium of local business owners and international education specialists, carries an estimated budget of \u00a54.2 billion.",
      },
      {
        type: "text",
        content:
          '"Niseko has transformed from a seasonal ski destination to a year-round international community," said Mayor Fumiko Tanaka at the council meeting. "Our children \u2014 whether they speak Japanese, English, Mandarin, or any other language \u2014 deserve world-class education right here at home."',
      },
      {
        type: "text",
        content:
          "The school will follow the International Baccalaureate curriculum while integrating Japanese language and cultural studies. Initial enrollment capacity is planned for 450 students, with bilingual instruction in English and Japanese.",
      },
      {
        type: "text",
        content:
          "The expatriate population in the Niseko area has grown 340% over the past decade, with year-round foreign residents now numbering over 3,200. Many families currently face long commutes to international schools in Sapporo, a 2.5-hour drive in winter conditions.",
      },
    ],
    sourceLog: [
      {
        source: "Kutchan Town Council Minutes",
        verified: true,
        notes: "Official proceedings",
      },
      {
        source: "Mayor Tanaka press conference",
        verified: true,
        notes: "Direct quotes verified",
      },
    ],
    riskFlags: [],
  },
  {
    headline:
      "New Craft Brewery Opens in Hirafu: Yuki Brewing Taps Into Niseko\u2019s Water",
    summary:
      "Yuki Brewing Company has opened Niseko\u2019s first craft brewery, using snowmelt-filtered spring water from Mount Yotei to create a lineup of Japanese-inspired ales.",
    topicTags: ["business", "culture"],
    geoTags: ["hirafu", "niseko"],
    isGated: false,
    contentBlocks: [
      {
        type: "text",
        content:
          "After three years of planning and construction, Yuki Brewing Company poured its first pints on Saturday at its new taproom on Hirafu Zaka street. The brewery is Niseko\u2019s first dedicated craft beer operation, and its secret weapon flows straight from Mount Yotei.",
      },
      {
        type: "text",
        content:
          '"The water here is extraordinary," said founder and head brewer Marcus Chen, a former Melbourne restaurateur who moved to Niseko in 2021. "Mount Yotei\u2019s volcanic geology filters snowmelt through layers of rock for decades before it reaches our aquifer. It\u2019s naturally soft, mineral-balanced, and perfect for brewing."',
      },
      {
        type: "text",
        content:
          "The opening lineup features five beers: a crisp Hokkaido Rice Lager, a Yuzu Wheat ale, a robust Volcanic Porter, a hop-forward Powder Day IPA, and a seasonal Sake Yeast Saison fermented with yeast sourced from a Yoichi sake brewery.",
      },
      {
        type: "text",
        content:
          "The 180-seat taproom occupies a renovated former pension, with floor-to-ceiling windows offering views of the ski slopes. A menu of Japanese-Western fusion pub fare \u2014 think miso-glazed wings and Hokkaido cheese boards \u2014 complements the beer list.",
      },
      {
        type: "text",
        content:
          "Yuki Brewing plans to begin canning and distribution to Sapporo retailers by spring, with the goal of eventually exporting to Australian and Southeast Asian markets. Chen expects to produce 120,000 liters in the first year.",
      },
    ],
    sourceLog: [
      {
        source: "Interview with Marcus Chen",
        verified: true,
        notes: "On-site visit and tasting",
      },
    ],
    riskFlags: [],
  },
  {
    headline:
      "Bear Sighting Near Annupuri Prompts Trail Closures in Niseko Backcountry",
    summary:
      "Niseko Town has temporarily closed three popular hiking and backcountry ski access trails after a brown bear was spotted foraging near the Annupuri peak area.",
    topicTags: ["safety", "environment"],
    geoTags: ["annupuri", "niseko"],
    isGated: false,
    contentBlocks: [
      {
        type: "text",
        content:
          "Three backcountry access trails near Annupuri have been closed after a Hokkaido brown bear was spotted by a ski touring group approximately 800 meters from the Annupuri summit gondola station on Monday morning.",
      },
      {
        type: "text",
        content:
          "The bear, estimated to be an adult male weighing approximately 250 kilograms based on track analysis, was observed foraging in a stand of dwarf bamboo at around 7:45 AM. Wildlife rangers from the Hokkaido Department of Environment responded within two hours.",
      },
      {
        type: "text",
        content:
          '"While bear encounters during winter are uncommon, they are not unprecedented," said ranger Kenji Oba. "Warmer-than-average temperatures in early February may have disrupted this individual\u2019s hibernation. We\u2019re asking all backcountry users to avoid the closed areas until we confirm the bear has moved on or re-entered its den."',
      },
      {
        type: "text",
        content:
          "The closed trails include the Annupuri East Ridge access, the Five Lakes trail, and the Iwaonupuri traverse. Niseko United resort operations are not affected, as all closures are in unpatrolled backcountry areas.",
      },
      {
        type: "text",
        content:
          "Authorities recommend all backcountry users carry bear bells, travel in groups, and report any sightings to the Niseko Town wildlife hotline at 0136-44-2121. The closures will be reviewed daily.",
      },
    ],
    sourceLog: [
      {
        source: "Hokkaido Department of Environment",
        verified: true,
        notes: "Official advisory",
      },
      {
        source: "Ranger Kenji Oba",
        verified: true,
        notes: "Phone interview",
      },
    ],
    riskFlags: [
      {
        type: "sensitive_location",
        description: "Backcountry access points named",
        severity: "low",
      },
    ],
  },
  {
    headline:
      "Niseko Winter Music Festival Returns with Three-Day Lineup at Hanazono",
    summary:
      "The annual Niseko Winter Music Festival is back for its sixth edition, bringing international and Japanese artists to an outdoor snow stage at Hanazono Resort from February 21-23.",
    topicTags: ["events", "culture"],
    geoTags: ["hanazono", "niseko"],
    isGated: false,
    contentBlocks: [
      {
        type: "text",
        content:
          "Hanazono Resort will transform into an alpine concert venue next weekend as the Niseko Winter Music Festival returns for its sixth year. Running February 21-23, the festival promises three days of live music against the dramatic backdrop of Mount Yotei.",
      },
      {
        type: "text",
        content:
          "This year\u2019s headline acts include Tokyo electronic duo Yoshino & Sato, Australian indie rock band The Mountain Collective, and Grammy-nominated jazz pianist Hiromi Uehara, who will perform a special sunset set on Saturday evening.",
      },
      {
        type: "text",
        content:
          '"We\u2019ve built the stage to face Yotei-zan, so when Hiromi plays at golden hour, the mountain will be glowing behind her," said festival director Yuki Sasaki. "It\u2019s a moment you simply cannot experience anywhere else on earth."',
      },
      {
        type: "text",
        content:
          "The snow stage, constructed entirely from packed snow and ice with a translucent ice roof, seats 2,500 and features a state-of-the-art sound system designed for cold-weather acoustics. Heated sake bars and food stalls from Niseko\u2019s top restaurants ring the venue.",
      },
      {
        type: "text",
        content:
          "Tickets are priced at \u00a58,500 for single-day passes and \u00a522,000 for the full festival. A limited VIP package at \u00a545,000 includes a private onsen session and backstage access. Shuttles will run from Hirafu, Kutchan, and Niseko Village every 20 minutes.",
      },
    ],
    sourceLog: [
      {
        source: "Niseko Winter Music Festival press release",
        verified: true,
        notes: "Official announcement",
      },
    ],
    riskFlags: [],
  },
  {
    headline:
      "Mount Yotei Backcountry Skier Rescued After 12-Hour Ordeal in Whiteout",
    summary:
      "A 34-year-old Australian man was rescued by helicopter after spending 12 hours stranded on the western flanks of Mount Yotei during a sudden whiteout. He is in stable condition.",
    topicTags: ["safety", "breaking"],
    geoTags: ["yotei", "niseko"],
    isGated: false,
    contentBlocks: [
      {
        type: "text",
        content:
          "A backcountry skier was airlifted from Mount Yotei early Wednesday morning after spending 12 hours stranded in near-zero visibility conditions on the volcano\u2019s exposed western face.",
      },
      {
        type: "text",
        content:
          "The man, identified as 34-year-old Melbourne resident James Cooper, departed from the Makkari trailhead at approximately 7 AM Tuesday for a solo summit attempt. When conditions deteriorated rapidly around 2 PM, he became disoriented in a whiteout and was unable to locate the descent route.",
      },
      {
        type: "text",
        content:
          "Cooper activated his personal locator beacon at 3:15 PM, triggering a response from the Hokkaido Mountain Rescue Team. However, extreme winds gusting to 80 km/h and near-zero visibility prevented helicopter operations until first light Wednesday.",
      },
      {
        type: "text",
        content:
          '"He did several things right \u2014 he carried a beacon, he dug a snow shelter, and he had emergency bivouac gear," said rescue team leader Hiroshi Sato. "Without those preparations, the outcome could have been very different. But we want to emphasize: solo backcountry travel on Yotei is extremely risky, especially during unstable weather windows."',
      },
      {
        type: "text",
        content:
          "Cooper was flown to Kutchan Red Cross Hospital where he is being treated for mild hypothermia and frostbite to his fingers. His condition is described as stable. Niseko Town officials are again urging all backcountry users to register their plans, travel with partners, and carry emergency communication devices.",
      },
    ],
    sourceLog: [
      {
        source: "Hokkaido Mountain Rescue Team",
        verified: true,
        notes: "Official report",
      },
      {
        source: "Kutchan Red Cross Hospital",
        verified: true,
        notes: "Condition confirmed",
      },
    ],
    riskFlags: [
      {
        type: "identifiable_private_individual",
        description: "Named individual involved in rescue",
        severity: "medium",
      },
    ],
  },
];

async function publishStory(s) {
  // 1. Create story
  const story = await api("POST", "/api/stories", {
    headline: s.headline,
    summary: s.summary,
    topicTags: s.topicTags,
    geoTags: s.geoTags,
    isGated: s.isGated,
  });
  if (!story.id) {
    console.log("FAIL create:", JSON.stringify(story).substring(0, 200));
    return;
  }
  console.log("Created:", story.id, s.headline.substring(0, 60));

  // 2. Create version
  const ver = await api("POST", "/api/stories/" + story.id + "/versions", {
    contentBlocks: s.contentBlocks,
    sourceLog: s.sourceLog,
    publicSources: [],
    riskFlags: s.riskFlags,
  });
  if (!ver.id && !ver.versionHash) {
    console.log("  FAIL version:", JSON.stringify(ver).substring(0, 200));
    return;
  }
  const vHash = ver.versionHash;
  console.log("  Version:", vHash?.substring(0, 16) + "...");

  // 3. Approve
  const riskAcks = s.riskFlags.map((f) => ({
    flagType: f.type,
    acknowledged: true,
    justification: "Reviewed and approved by editor",
  }));
  const approval = await api(
    "POST",
    "/api/stories/" + story.id + "/approve",
    {
      versionHash: vHash,
      decision: "approved",
      notes: "Approved for publication",
      riskAcknowledgements: riskAcks,
    }
  );
  if (approval.error) {
    console.log("  FAIL approve:", JSON.stringify(approval).substring(0, 200));
    return;
  }
  console.log("  Approved");

  // 4. Publish
  const pub = await api("POST", "/api/stories/" + story.id + "/publish", {
    versionHash: vHash,
  });
  if (!pub.success) {
    console.log("  FAIL publish:", JSON.stringify(pub).substring(0, 200));
    return;
  }
  console.log("  Published!\n");
}

(async () => {
  console.log("Seeding 6 Niseko stories...\n");
  for (const s of stories) {
    await publishStory(s);
  }
  console.log("Done! Refresh the feed at https://niseko-gazet.vercel.app/feed");
})();
