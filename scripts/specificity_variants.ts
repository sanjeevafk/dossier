import type { EvalCase } from "../src/evaluation/cases.js";

/**
 * Detailed ("founder-confident") variants of the labelled dev-split cases for the specificity experiment.
 *
 * Rules used when writing these (pre-registered before running):
 *  - Added content is limited to: geography/segment, distribution channel, a claimed wedge,
 *    founder-stated numbers (CAC, order frequency, retention, cost anchors, modest traction).
 *  - The same kinds of additions are made for successes and failures. Numbers are plausible and
 *    internally consistent with the stated price, and carry the founder's improvement claims
 *    ("cost falls to X at density") rather than verdict-flavoured judgments.
 *  - Nothing about why the real analogue died or succeeded, no execution difficulties,
 *    no competitor fates, no market events.
 */
export interface SpecificityVariant {
  /** Appended to the original summary. */
  extra: string;
  /** Replaces the monetization text (kept parseable: stated price + period, or take-rate). */
  monetization: string;
  audience?: string;
}

export const SPECIFICITY_VARIANTS: Record<EvalCase["id"], SpecificityVariant> = {
  // ---- failures: hand-written analogues -------------------------------------------------------
  "F4-grocery-warehouse-delivery": {
    extra:
      "Launching in Dallas and Austin first with company-run dark stores; average basket $38, delivery cost $6 per order today projected to $2.50 at target density, households ordering 1.4 times a week, CAC $22 from referrals and local ads.",
    monetization: "We keep a 3.5% margin on groceries; the average order is $38 with no delivery fee."
  },
  "X-F01": {
    extra:
      "Launching at $1,500 in the US with an industrial pack for field technicians who need hands-free documentation; 12MP camera, six-hour battery; 2,000 units pre-ordered through the launch campaign; first retail channel is electronics specialists.",
    monetization: "$1,500 per device, one-time."
  },
  "X-F02": {
    extra:
      "The countertop device sells to pharmacies at $9,000; each panel is billed to the customer at $28 with the pharmacy keeping $9; a pharmacy processes about 15 walk-in panels a day; 40 pharmacies across Texas are in the pilot; assays are CLIA-waived at launch.",
    monetization: "$28 per test panel shared with pharmacies ($9 pharmacy margin)."
  },
  "X-F10": {
    extra:
      "Operating in Chicago with a four-hour turnaround SLA; customers send about 1.8 bags per order and 55% reorder within 30 days; CAC $35 through office partnerships and building flyers; the facility runs 600 bags a day at a fully loaded cost of $9 per bag.",
    monetization: "$25 per bag, flat price."
  },
  "X-F11": {
    extra:
      "Launching with 40 mid-tier creators; members pay $3 a month and creators keep half of their members' fees; the average member watches nine early videos a month; CAC is about $2 through creator shout-outs.",
    monetization: "$3 per month subscription; 50% revenue share to creators."
  },
  "X-F12": {
    extra:
      "$5,000 retail with 25 km range and 18 km/h top speed; sold through 30 urban mobility dealerships plus direct online; the target commute is 3 to 8 km; unit cost $3,100 at pilot volumes; 600 units sold in the first season.",
    monetization: "$5,000 per unit, one-time."
  },
  "X-F17": {
    extra:
      "Partnered with 120 high schools across three states for the football season; packs sell at $5 with rare cards up to $50; schools keep 30% of primary sales; the average buyer spends $19 a season.",
    monetization: "10% fee on each trade; 60% of primary card sales retained."
  },
  "X-F19": {
    extra:
      "The quiz maps 32 skin attributes; each bottle is a two-month supply and replenishment lands every 45 days; 45% of first-time buyers reorder within 90 days; blended CAC $52 from Instagram and TikTok creative tested weekly; the partner factory is in New Jersey.",
    monetization: "$60 per bottle, subscription option at $54 per bottle every 45 days."
  },
  "X-F20": {
    extra:
      "Members keep or swap monthly; the closet rotates 1,200 pairs across sizes 7 to 13; the average member stays five months; both-way shipping is included; CAC $40 through sneaker-community partnerships and drops with boutique brands.",
    monetization: "$99 per month subscription."
  },
  "X-F22": {
    extra:
      "The robot cooks 14 recipes at launch from sealed packs; a household subscribes to 8 packs a month; packs ship weekly and keep 10 days refrigerated; 900 households on the pilot waitlist; robot unit cost $290 at pilot volumes.",
    monetization: "$500 robot plus $10 per meal pack ($80 per month for the 8-pack subscription)."
  },
  "X-F23": {
    extra:
      "The pet evolves daily and remembers the user's week; day-7 retention is 35% and day-30 is 12%; installs come from TikTok at $0.90 per install; 250,000 installs in the first quarter.",
    monetization: "$6 per month subscription keeps the pet active."
  },
  "X-F25": {
    extra:
      "Average members invest $11 a month in round-ups into curated crypto portfolios; 60,000 signups in six months via campus ambassadors; the conversion spread is 0.75%; after year one the fee is $1 a month.",
    monetization: "0.75% spread on trades; $1 per month after the first year."
  },
  "X-F30": {
    extra:
      "The $30,000 SUV claims 500 km range from the onboard recharging rotor with no plug; 300 reservations at $200; the first road-legal prototypes are in registration testing.",
    monetization: "$30,000 per vehicle."
  },

  // ---- successes -------------------------------------------------------------------------------
  "S5-smb-storefront": {
    extra:
      "Built first for sellers in emerging markets: themes optimised for low-end Android phones, checkout with local payment methods and cash pickup, shipping labels for the three largest regional carriers; 40,000 stores created, 8% of free stores convert to the paid plan within 90 days, CAC $18 via SEO and word of mouth, monthly store churn 2.5%.",
    monetization: "$29 per month per store plus a 2.9% payment processing fee on sales."
  },
  "X-S02": {
    extra:
      "Launching city by city starting with Austin and Portland around design and music conference weekends; the first 500 hosts were recruited by hand; average stay three nights and 35% of guests rebook within a year; guests pay a 12% booking fee and hosts list free.",
    monetization: "12% booking fee on each reservation paid by guests."
  },
  "X-S03": {
    extra:
      "Launching motorbike taxis in one congested Southeast Asian metro before adding cars; cash and in-app e-wallet are both accepted; drivers keep 80% of the fare and are recruited through rider referrals; average pickup under four minutes.",
    monetization: "20% commission per ride."
  },
  "X-S11": {
    extra:
      "60,000 developers use the free desktop app; 4% of team workspaces convert to the paid plan; distribution is SEO and developer word of mouth with near-zero CAC; monthly workspace churn 1.5%.",
    monetization: "Free for individuals, $12 per user per month for teams."
  },
  "X-S14": {
    extra:
      "20,000 teams on the free tier and 6% converting to paid; teams expand 15% quarter over quarter; CAC $70 through content marketing with a four-month payback; the typical team is 5 to 20 seats.",
    monetization: "Free basic, $10 per user per month."
  },
  "X-S16": {
    extra:
      "Self-serve signup; a developer makes a first call in an afternoon; 2,200 paying accounts; net revenue retention is 130% as usage grows.",
    monetization: "$0.0075 per SMS and $0.014 per voice minute, billed by usage."
  },
  "X-S17": {
    extra:
      "One OAuth-style integration covers 900 US banks; 140 fintech apps are live; seed-stage sales cycles run three weeks; volume tiers above 10,000 connections.",
    monetization: "$1 per connected account per month."
  },
  "X-S20": {
    extra:
      "18,000 sellers with an average shop of 22 items; 45% of buyers purchase again within six months; sellers come from craft fairs and maker communities, buyers from search.",
    monetization: "$0.20 per listing plus 5% transaction fee."
  },
  "X-S21": {
    extra:
      "1,200 paid newsletters with a median paid list of 900 subscribers; free newsletters pay nothing; card payments with monthly payouts; writers migrate from legacy email tools for the built-in reader website.",
    monetization: "10% of subscription revenue."
  },
  "X-S22": {
    extra:
      "9,000 creators earning with tiers at $3, $10 and $25; the average patron pledges $7 a month; creators bring their own audience so the platform spends nothing on acquisition; payouts are monthly.",
    monetization: "5 to 12 percent of creator earnings by plan tier."
  },
  "X-S29": {
    extra:
      "8,000 courses with an average price of $14 at discount; instructors keep 70% of sales they drive and 30% of marketplace-driven sales; demand comes from SEO; instructors are recruited from creator communities.",
    monetization: "Revenue share on each course sold (70% instructor-driven, 30% platform-driven)."
  },
  "X-S30": {
    extra:
      "Compares 400,000 properties through 30 supplier APIs; 50,000 monthly visitors from SEO with a 2.8% booking conversion; no sign-up required; hotels pay commission on booked nights.",
    monetization: "15% commission from hotels on each booking."
  },

  // ---- failures: real shut-downs from Loot Drop -------------------------------------------------
  "L-02-1510": {
    extra:
      "Launching in Dallas-Fort Worth; employers pay 15% of the worker's first 90 days' pay on hire; every worker is W-2 verified with OSHA certification on file; the pilot fills 60 roles a month at $1,100 per placement versus the $2,500 agencies charge.",
    monetization: "15% of the first 90 days' pay, paid by the employer on each placement."
  },
  "L-05-2452": {
    extra:
      "Licensing to two mid-tier OEMs with a pilot fleet of 25 vehicles on a 40 km Phoenix corridor; the sensor suite costs $18,000 per vehicle at pilot volumes; integration engineering is billed at $250,000 per OEM program; disengagements fell 40% over the last six months of testing.",
    monetization: "Per-vehicle license fee plus engineering services at $250k per OEM integration program."
  },
  "L-06-2176": {
    extra:
      "Operating in three cities with 180 units under management; guests pay about $95 a night for 30-to-90-day stays; owners receive 75% of booking revenue with cleaning and maintenance handled by vetted local partners; occupancy is 82%.",
    monetization: "25% service margin on each extended-stay booking."
  },
  "L-07-2404": {
    extra:
      "Sourcing baby formula, cosmetics and supplements from Australia and Germany into a bonded warehouse in Zhengzhou; average order $72 at a 35% margin on direct-sourced lines; 8,000 orders a month through WeChat and Tmall storefronts.",
    monetization: "35% margin on sales of directly sourced overseas products."
  },
  "L-08-1639": {
    extra:
      "Launching in Phoenix and Tucson with 400 verified providers; providers list free and the platform takes a booking commission; the average job is $85 and 40% of customers rebook within 60 days.",
    monetization: "15% commission on bookings made through the platform."
  },
  "L-09-2506": {
    extra:
      "Connecting 40 independent warehouses and 12 carriers across the EU; 25 merchants live, each shipping about 1,200 parcels a month; one API covers inventory, fulfillment and returns with per-shipment pricing.",
    monetization: "€1.90 per pick-and-pack order plus a 4% fee on carrier shipping cost."
  },
  "L-15-1950": {
    extra:
      "Guides answer in under five minutes at a cost of $0.11 per query with part-time contractors; 30,000 queries a week; the free service is ad-supported with a 60% fill rate at a $4 CPM.",
    monetization: "Advertising around search results ($4 CPM, 60% fill rate)."
  },
  "L-16-1928": {
    extra:
      "Creators pitch app ideas with milestone plans; backers fund in tranches; 90 projects listed and the average funded project raises $12,000; developers apply to build funded ideas through the platform.",
    monetization: "8% of funds raised plus 15% of app revenue for two years."
  },
  "L-21-1910": {
    extra:
      "Free ad-supported tier plus an $8 ad-free tier with live listening rooms; DJs host rooms nightly; 45,000 monthly listeners averaging 22-minute sessions; the catalog is label-cleared through aggregator deals.",
    monetization: "$8 per month ad-free subscription plus audio advertising."
  },
  "L-22-2467": {
    extra:
      "Screens sell at $850 per unit with the content platform at $25 per screen per month; 70 venues live — retail chains and clinics — with an average deal of 12 screens; installs are completed in one visit.",
    monetization: "$850 per screen plus $25 per screen per month software fee."
  },
  "L-23-1875": {
    extra:
      "Clients pay a monthly retainer; 25 clients are served by a six-person content team in a lower-cost hub; gross margin 55%; the average client stays nine months; acquisition is via referrals from agency partners.",
    monetization: "$1,800 per month retainer per client."
  },
  "L-26-2484": {
    extra:
      "Three pilot DAOs and two remote-first companies stream $2.1M of annualized payroll; integrates through existing HRIS exports; wages move on USDC rails with instant employee access to earned wages.",
    monetization: "0.4% fee on streamed payroll and automated recurring payments."
  },
  "L-28-2498": {
    extra:
      "AI matchmaking runs on a skills-and-interest graph; 12 enterprise pilots of 200 seats each; spatial-audio rooms let people move between conversations; individuals use the free tier.",
    monetization: "$6 per user per month for enterprise teams; free for individuals."
  },
  "L-30-2135": {
    extra:
      "The flagship SUV is priced at $16,000 with 400 km range and over-the-air updates; initial capacity is 1,500 units a year at an 8% launch gross margin, sold only online with home delivery in tier-1 cities.",
    monetization: "Direct vehicle sales at $16,000 per SUV."
  },
  "L-35-1317": {
    extra:
      "Connects to Xero and QuickBooks to auto-categorise transactions and reconcile accounts; 180 SMBs live; pilot customers cut bookkeeper hours by 60%; CAC $210 via accountant referral partnerships.",
    monetization: "$79 per month subscription per business."
  },
  "L-36-2081": {
    extra:
      "The vehicle sells at $95,000 against $70,000 for a diesel equivalent but runs 40% cheaper per kilometre; three city operators run paid pilots; 210 km range is sized for urban routes; a battery-lease option spreads the premium over four years.",
    monetization: "$95,000 per vehicle, with an optional battery lease at $850 per month."
  },
  "L-39-2534": {
    extra:
      "Tutors from top universities are exam-score verified; the average session is ¥180 and parents book through WeChat; 1,400 tutors live and 70% of students rebook monthly.",
    monetization: "20% commission on each live tutoring session (average ¥180)."
  },
  "L-40-1468": {
    extra:
      "Includes an OBD-II dongle per vehicle; two fleets of 400 vehicles are in paid pilots; predicted-maintenance alerts and route optimisation are claimed to cut fuel spend 9%; onboarding takes a day per fleet.",
    monetization: "$8 per vehicle per month platform fee."
  },
  "L-45-2195": {
    extra:
      "Open-source core with 3,200 GitHub stars; 40 design partners from the launch; joins and subscriptions run client-side without polling or custom pub/sub infrastructure.",
    monetization: "Hosted service at $0.10 per GB-month plus a $49 per month support tier."
  },
  "L-47-2416": {
    extra:
      "Two mobile titles launched with $0.9M revenue in year one; user acquisition runs $1.10 per install against $1.90 day-30 LTV; five more titles in production on shared engine and analytics tooling.",
    monetization: "Revenue from game sales and in-game purchases."
  },
  "L-48-2287": {
    extra:
      "Two fleets run 40 trucks on the I-10 corridor at 15 m following distance saving a measured 6.5% fuel; drivers stay in the lead truck; retrofit installation takes one day per truck.",
    monetization: "$600 per truck per year license plus $2,400 one-time hardware per truck."
  },
  "L-49-1411": {
    extra:
      "Consolidates project tracking, whiteboarding and repo triage; 30 teams live averaging nine seats; one-click migration from Jira and Notion; CAC $140 blended across product-led signup and light outbound.",
    monetization: "$19 per user per month subscription."
  },
  "L-52-2461": {
    extra:
      "Scissor lifts start at ¥68,000, about 40% below imported brands; two production lines support 900 units a year; distribution through 60 equipment dealers across eastern China; gross margin 22%.",
    monetization: "Revenue from manufacturing and selling aerial work platforms (scissor lifts from ¥68,000)."
  },
  "L-54-2353": {
    extra:
      "Small-group classes in three second-tier cities with 700 enrolled students; Western-trained instructors; the online platform is bundled; 65% of students renew for the next term.",
    monetization: "Tuition of ¥350 per class hour, paid per term."
  },
  "L-55-2013": {
    extra:
      "Sold to destination marketing organisations and travel agencies; itineraries are generated from 40 data sources with supplier booking links; five DMOs pay today and agencies resell itineraries as $29 add-ons.",
    monetization: "$1,500 per month per brand enterprise subscription."
  }
};
