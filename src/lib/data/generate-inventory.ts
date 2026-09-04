import type {
  BodyType,
  Condition,
  FuelType,
  HistoryEvent,
  Transmission,
  Vehicle,
  VehicleSpec,
} from "@/lib/types";
import { photosFor } from "./vehicle-images";
import { colorLabelForImageUrl, VEHICLE_COLOR_OPTIONS } from "@/lib/vehicles/vehicle-colors";

import { CHINESE_MAKES } from "@/lib/vehicles/chinese-makes";

export { CHINESE_MAKES };

const LOCATIONS = [
  "Accra, Ghana",
  "Kumasi, Ghana",
  "Tema, Ghana",
  "Takoradi, Ghana",
  "Cape Coast, Ghana",
];

const COLORS = VEHICLE_COLOR_OPTIONS.map((opt) => opt.label);

const CONDITIONS: Condition[] = ["New", "Used", "Certified Pre-Owned"];
const TRANSMISSIONS: Transmission[] = ["Automatic", "DCT", "CVT", "Manual"];

interface ModelTemplate {
  model: string;
  bodyType: BodyType;
  fuelTypes: FuelType[];
  priceRange: [number, number];
  trims: string[];
  engineSizes: string[];
}

interface BrandTemplate {
  make: string;
  count: number;
  models: ModelTemplate[];
  featuredRatio?: number;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function pickInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function buildSpecs(
  bodyType: BodyType,
  fuelType: FuelType,
  rand: () => number
): VehicleSpec[] {
  const hp = pickInt(rand, 120, 450);
  const specs: VehicleSpec[] = [
    { label: "Drivetrain", value: pick(rand, ["FWD", "AWD", "RWD", "4WD"]) },
    { label: "Horsepower", value: `${hp} hp` },
    { label: "Seating", value: `${bodyType === "Commercial" ? 2 : pickInt(rand, 5, 7)} passengers` },
  ];
  if (fuelType === "Electric" || fuelType === "Plug-in Hybrid") {
    specs.push({ label: "Range", value: `${pickInt(rand, 280, 650)} km CLTC` });
  }
  return specs;
}

function buildHistory(rand: () => number): HistoryEvent[] {
  return [
    {
      date: "Feb 2026",
      title: pick(rand, ["Certified Inspection", "Listed", "EV Inspection", "New Arrival"]),
      description: pick(rand, [
        "Passed 150-point Nabus Motors inspection",
        "Added to Nabus Motors inventory",
        "Battery and systems verified",
        "Fresh stock from authorised importer",
      ]),
    },
  ];
}

function generateVehicle(
  brand: BrandTemplate,
  modelTpl: ModelTemplate,
  index: number,
  globalId: number
): Vehicle {
  const rand = seeded(globalId * 997 + index * 13);
  const year = pickInt(rand, 2020, 2025);
  const trim = pick(rand, modelTpl.trims);
  const fuelType = pick(rand, modelTpl.fuelTypes);
  const condition = pick(rand, CONDITIONS);
  const mileage =
    condition === "New" ? pickInt(rand, 500, 4500) : pickInt(rand, 8000, 85000);
  const price =
    pickInt(rand, modelTpl.priceRange[0], modelTpl.priceRange[1]) -
    (mileage > 40000 ? pickInt(rand, 800, 3500) : 0);
  const slug = `${year}-${slugify(brand.make)}-${slugify(modelTpl.model)}-${slugify(trim)}-${index}`;
  const featured = rand() < (brand.featuredRatio ?? 0.12);
  const location = pick(rand, LOCATIONS);
  const images = photosFor(slug, globalId, modelTpl.bodyType);
  const color = colorLabelForImageUrl(images[0]) ?? pick(rand, COLORS);
  const transmission =
    fuelType === "Electric"
      ? "Automatic"
      : pick(rand, TRANSMISSIONS.filter((t) => t !== "Manual" || rand() > 0.7));

  const month = pickInt(rand, 1, 12);
  const createdAt = `2026-${String(month).padStart(2, "0")}-${String(pickInt(rand, 1, 28)).padStart(2, "0")}`;
  const statusRoll = rand();
  const status =
    statusRoll < 0.82
      ? "available"
      : statusRoll < 0.95
        ? "pre_order"
        : "reserved";

  const isGhanaStock = location.toLowerCase().includes("ghana");
  const isChinese = CHINESE_MAKES.includes(brand.make as (typeof CHINESE_MAKES)[number]);
  const availableLocally = isGhanaStock && status === "available" && rand() < 0.35;

  return {
    id: String(globalId),
    slug,
    make: brand.make,
    model: modelTpl.model,
    year,
    trim,
    price,
    mileage,
    fuelType,
    transmission,
    condition,
    bodyType: modelTpl.bodyType,
    location,
    engineSize: pick(rand, modelTpl.engineSizes),
    color,
    vin: `${slugify(brand.make).slice(0, 3).toUpperCase()}${year}${String(globalId).padStart(5, "0")}`,
    description: `${year} ${brand.make} ${modelTpl.model} ${trim} — verified, inspected, and ready for delivery across Ghana. Transparent pricing with full documentation from Nabus Motors.`,
    featured,
    images,
    specs: buildSpecs(modelTpl.bodyType, fuelType, rand),
    history: buildHistory(rand),
    status,
    countryOfOrigin: isGhanaStock ? "ghana" : isChinese ? "china" : "other",
    financingAvailable: rand() < 0.7,
    shipmentAvailable: !availableLocally && status !== "pre_order" && rand() < 0.85,
    customsClearingAvailable: !isGhanaStock && rand() < 0.8,
    availableLocally,
    createdAt,
  };
}

function generateForBrand(brand: BrandTemplate, startId: number): Vehicle[] {
  const list: Vehicle[] = [];
  let id = startId;

  for (let i = 0; i < brand.count; i++) {
    const modelTpl = brand.models[i % brand.models.length];
    list.push(generateVehicle(brand, modelTpl, i + 1, id));
    id++;
  }

  return list;
}

const CHINESE_BRANDS: BrandTemplate[] = [
  {
    make: "BYD",
    count: 10,
    featuredRatio: 0.25,
    models: [
      { model: "Atto 3", bodyType: "SUV", fuelTypes: ["Electric"], priceRange: [22000, 32000], trims: ["Standard", "Extended", "Design"], engineSizes: ["Single Motor FWD", "Single Motor AWD"] },
      { model: "Seal", bodyType: "Sedan", fuelTypes: ["Electric"], priceRange: [30000, 42000], trims: ["Dynamic", "Premium", "Performance"], engineSizes: ["Dual Motor AWD", "Single Motor RWD"] },
      { model: "Dolphin", bodyType: "Hatchback", fuelTypes: ["Electric"], priceRange: [16000, 24000], trims: ["Active", "Boost", "Design"], engineSizes: ["Single Motor FWD"] },
      { model: "Song Plus", bodyType: "SUV", fuelTypes: ["Plug-in Hybrid", "Electric"], priceRange: [28000, 38000], trims: ["DM-i", "EV Flagship"], engineSizes: ["1.5L Hybrid", "Dual Motor AWD"] },
      { model: "Tang", bodyType: "SUV", fuelTypes: ["Electric", "Plug-in Hybrid"], priceRange: [38000, 52000], trims: ["EV", "DM-i"], engineSizes: ["Dual Motor AWD"] },
      { model: "Han", bodyType: "Luxury", fuelTypes: ["Electric"], priceRange: [36000, 48000], trims: ["EV", "DM-i Premium"], engineSizes: ["Dual Motor AWD"] },
      { model: "Yuan Plus", bodyType: "SUV", fuelTypes: ["Electric"], priceRange: [24000, 30000], trims: ["Superior", "Design"], engineSizes: ["Single Motor FWD"] },
    ],
  },
  {
    make: "Geely",
    count: 4,
    models: [
      { model: "Coolray", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [18000, 26000], trims: ["Comfort", "Flagship"], engineSizes: ["1.5L Turbo I3"] },
      { model: "Monjaro", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [28000, 36000], trims: ["Luxury", "Flagship"], engineSizes: ["2.0L Turbo I4"] },
      { model: "Emgrand", bodyType: "Sedan", fuelTypes: ["Petrol"], priceRange: [14000, 20000], trims: ["Pro", "Premium"], engineSizes: ["1.5L I4"] },
    ],
  },
  {
    make: "Chery",
    count: 4,
    models: [
      { model: "Tiggo 8 Pro", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [22000, 30000], trims: ["Pro", "Max"], engineSizes: ["1.6L Turbo I4"] },
      { model: "Tiggo 7 Pro", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [20000, 27000], trims: ["Comfort", "Max"], engineSizes: ["1.6L Turbo I4"] },
      { model: "Omoda 5", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [19000, 25000], trims: ["Comfort", "Elegance"], engineSizes: ["1.5L Turbo I4"] },
      { model: "Omoda E5", bodyType: "SUV", fuelTypes: ["Electric"], priceRange: [22000, 28000], trims: ["Comfort", "Premium"], engineSizes: ["Single Motor FWD"] },
    ],
  },
  { make: "MG", count: 3, models: [
      { model: "ZS EV", bodyType: "Electric", fuelTypes: ["Electric"], priceRange: [20000, 28000], trims: ["Excite", "Essence"], engineSizes: ["Single Motor FWD"] },
      { model: "HS", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [18000, 24000], trims: ["Excite", "Essence"], engineSizes: ["1.5L Turbo I4"] },
      { model: "4 EV", bodyType: "Hatchback", fuelTypes: ["Electric"], priceRange: [20000, 26000], trims: ["Standard", "XPOWER"], engineSizes: ["Single Motor RWD"] },
    ]},
  { make: "Haval", count: 3, models: [
      { model: "H6", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [20000, 28000], trims: ["Supreme", "GT"], engineSizes: ["2.0L Turbo I4"] },
      { model: "Jolion", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [16000, 22000], trims: ["Ultra", "Premium"], engineSizes: ["1.5L Turbo I4"] },
    ]},
  { make: "Changan", count: 3, models: [
      { model: "CS75 Plus", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [22000, 30000], trims: ["Premium", "Tech"], engineSizes: ["1.5L Turbo I4"] },
      { model: "UNI-K", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [28000, 36000], trims: ["Premium", "Flagship"], engineSizes: ["2.0L Turbo I4"] },
      { model: "Eado Plus", bodyType: "Sedan", fuelTypes: ["Petrol"], priceRange: [17000, 24000], trims: ["Luxury", "Premium"], engineSizes: ["1.4L Turbo I4"] },
    ]},
  { make: "GWM", count: 3, models: [
      { model: "Ora 03", bodyType: "Hatchback", fuelTypes: ["Electric"], priceRange: [24000, 30000], trims: ["GT", "Premium"], engineSizes: ["Single Motor FWD"] },
      { model: "Tank 300", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [32000, 40000], trims: ["City", "Adventure"], engineSizes: ["2.0L Turbo I4"] },
      { model: "Poer", bodyType: "Truck", fuelTypes: ["Diesel"], priceRange: [24000, 32000], trims: ["Premium", "Elite"], engineSizes: ["2.0L Turbo Diesel"] },
      { model: "Cannon Alpha", bodyType: "Truck", fuelTypes: ["Diesel"], priceRange: [28000, 36000], trims: ["Premium", "Ultra"], engineSizes: ["2.4L Turbo Diesel"] },
    ]},
  { make: "Jetour", count: 2, models: [
      { model: "X70 Plus", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [20000, 28000], trims: ["Luxury", "Premium"], engineSizes: ["1.6L Turbo I4"] },
      { model: "Dashing", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [22000, 29000], trims: ["Premium", "Flagship"], engineSizes: ["1.6L Turbo I4"] },
    ]},
  { make: "DFSK", count: 2, models: [
      { model: "Glory 580", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [14000, 20000], trims: ["Luxury", "Comfort"], engineSizes: ["1.5L Turbo I4"] },
    ]},
  { make: "BAIC", count: 2, models: [
      { model: "BJ40 Plus", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [24000, 32000], trims: ["Explorer", "Premium"], engineSizes: ["2.0L Turbo I4"] },
    ]},
  { make: "Lynk & Co", count: 2, models: [
      { model: "01", bodyType: "SUV", fuelTypes: ["Plug-in Hybrid", "Petrol"], priceRange: [26000, 34000], trims: ["PHEV", "Pro"], engineSizes: ["1.5L PHEV", "2.0L Turbo I4"] },
    ]},
  { make: "XPeng", count: 2, models: [
      { model: "P7", bodyType: "Sedan", fuelTypes: ["Electric"], priceRange: [32000, 42000], trims: ["RWD", "Performance"], engineSizes: ["Single Motor RWD", "Dual Motor AWD"] },
      { model: "G9", bodyType: "SUV", fuelTypes: ["Electric"], priceRange: [40000, 52000], trims: ["Pro", "Performance"], engineSizes: ["Dual Motor AWD"] },
    ]},
  { make: "NIO", count: 2, models: [
      { model: "ES6", bodyType: "SUV", fuelTypes: ["Electric"], priceRange: [42000, 55000], trims: ["Performance", "Signature"], engineSizes: ["Dual Motor AWD"] },
      { model: "ET5", bodyType: "Sedan", fuelTypes: ["Electric"], priceRange: [38000, 48000], trims: ["Long Range", "Performance"], engineSizes: ["Dual Motor AWD"] },
    ]},
  { make: "Hongqi", count: 2, models: [
      { model: "H9", bodyType: "Luxury", fuelTypes: ["Petrol"], priceRange: [48000, 65000], trims: ["Executive", "Presidential"], engineSizes: ["3.0L Supercharged V6"] },
      { model: "E-HS9", bodyType: "Luxury", fuelTypes: ["Electric"], priceRange: [52000, 72000], trims: ["Flagship", "Executive"], engineSizes: ["Dual Motor AWD"] },
    ]},
  { make: "Zeekr", count: 2, models: [
      { model: "001", bodyType: "SUV", fuelTypes: ["Electric"], priceRange: [42000, 52000], trims: ["WE", "YOU"], engineSizes: ["Dual Motor AWD"] },
    ]},
  { make: "Li Auto", count: 2, models: [
      { model: "L7", bodyType: "SUV", fuelTypes: ["Plug-in Hybrid"], priceRange: [44000, 56000], trims: ["Pro", "Max"], engineSizes: ["1.5L Range Extender"] },
      { model: "L9", bodyType: "SUV", fuelTypes: ["Plug-in Hybrid"], priceRange: [52000, 68000], trims: ["Pro", "Ultra"], engineSizes: ["1.5L Range Extender"] },
    ]},
  { make: "Aion", count: 2, models: [
      { model: "Y Plus", bodyType: "SUV", fuelTypes: ["Electric"], priceRange: [20000, 28000], trims: ["Plus", "Premium"], engineSizes: ["Single Motor FWD"] },
    ]},
  { make: "Wuling", count: 2, models: [
      { model: "Air EV", bodyType: "Hatchback", fuelTypes: ["Electric"], priceRange: [12000, 18000], trims: ["Standard", "Long Range"], engineSizes: ["Single Motor FWD"] },
    ]},
  { make: "Voyah", count: 2, models: [
      { model: "Free", bodyType: "SUV", fuelTypes: ["Plug-in Hybrid", "Electric"], priceRange: [40000, 52000], trims: ["Extended Range", "EV"], engineSizes: ["1.5L Range Extender", "Dual Motor AWD"] },
    ]},
  { make: "Denza", count: 2, models: [
      { model: "D9", bodyType: "Luxury", fuelTypes: ["Electric", "Plug-in Hybrid"], priceRange: [48000, 62000], trims: ["EV Executive", "DM-i"], engineSizes: ["Dual Motor AWD"] },
    ]},
];

const INTERNATIONAL_BRANDS: BrandTemplate[] = [
  { make: "BMW", count: 1, models: [
      { model: "X5", bodyType: "SUV", fuelTypes: ["Petrol", "Hybrid"], priceRange: [48000, 72000], trims: ["xDrive40i", "M50i"], engineSizes: ["3.0L Turbo I6"] },
      { model: "3 Series", bodyType: "Sedan", fuelTypes: ["Petrol"], priceRange: [32000, 48000], trims: ["320i", "330i"], engineSizes: ["2.0L Turbo I4"] },
      { model: "X3", bodyType: "SUV", fuelTypes: ["Petrol", "Hybrid"], priceRange: [38000, 52000], trims: ["xDrive30i", "M40i"], engineSizes: ["2.0L Turbo I4"] },
    ]},
  { make: "Mercedes-Benz", count: 1, models: [
      { model: "E-Class", bodyType: "Luxury", fuelTypes: ["Petrol", "Hybrid"], priceRange: [42000, 68000], trims: ["E 350", "E 450"], engineSizes: ["2.0L Turbo I4"] },
      { model: "GLC", bodyType: "SUV", fuelTypes: ["Petrol", "Hybrid"], priceRange: [40000, 58000], trims: ["GLC 300", "AMG Line"], engineSizes: ["2.0L Turbo I4"] },
      { model: "C-Class", bodyType: "Sedan", fuelTypes: ["Petrol"], priceRange: [35000, 52000], trims: ["C 300", "C 200"], engineSizes: ["2.0L Turbo I4"] },
    ]},
  { make: "Toyota", count: 1, models: [
      { model: "Camry", bodyType: "Sedan", fuelTypes: ["Hybrid", "Petrol"], priceRange: [24000, 38000], trims: ["LE", "XSE"], engineSizes: ["2.5L Hybrid I4"] },
      { model: "RAV4", bodyType: "SUV", fuelTypes: ["Hybrid", "Petrol"], priceRange: [28000, 42000], trims: ["XLE", "Limited"], engineSizes: ["2.5L Hybrid I4"] },
      { model: "Hilux", bodyType: "Truck", fuelTypes: ["Diesel"], priceRange: [32000, 48000], trims: ["SR", "GR Sport"], engineSizes: ["2.8L Turbo Diesel"] },
    ]},
  { make: "Ford", count: 1, models: [
      { model: "F-150", bodyType: "Truck", fuelTypes: ["Petrol", "Hybrid"], priceRange: [38000, 62000], trims: ["XLT", "Lariat"], engineSizes: ["3.5L EcoBoost V6"] },
      { model: "Explorer", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [34000, 48000], trims: ["XLT", "Limited"], engineSizes: ["2.3L Turbo I4"] },
      { model: "Transit", bodyType: "Commercial", fuelTypes: ["Diesel"], priceRange: [28000, 42000], trims: ["Cargo", "Crew"], engineSizes: ["2.0L Turbo Diesel"] },
    ]},
  { make: "Honda", count: 1, models: [
      { model: "CR-V", bodyType: "SUV", fuelTypes: ["Hybrid", "Petrol"], priceRange: [26000, 40000], trims: ["EX", "Touring"], engineSizes: ["1.5L Turbo I4"] },
      { model: "Accord", bodyType: "Sedan", fuelTypes: ["Hybrid", "Petrol"], priceRange: [24000, 36000], trims: ["Sport", "Touring"], engineSizes: ["1.5L Turbo I4"] },
      { model: "Pilot", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [32000, 46000], trims: ["EX-L", "Elite"], engineSizes: ["3.5L V6"] },
    ]},
  { make: "Tesla", count: 1, models: [
      { model: "Model 3", bodyType: "Electric", fuelTypes: ["Electric"], priceRange: [32000, 48000], trims: ["Long Range", "Performance"], engineSizes: ["Dual Motor AWD"] },
      { model: "Model Y", bodyType: "SUV", fuelTypes: ["Electric"], priceRange: [38000, 55000], trims: ["Long Range", "Performance"], engineSizes: ["Dual Motor AWD"] },
    ]},
  { make: "Audi", count: 1, models: [
      { model: "A6", bodyType: "Luxury", fuelTypes: ["Petrol", "Hybrid"], priceRange: [42000, 62000], trims: ["Premium Plus", "Prestige"], engineSizes: ["2.0L Turbo I4"] },
      { model: "Q5", bodyType: "SUV", fuelTypes: ["Petrol", "Hybrid"], priceRange: [38000, 55000], trims: ["Premium", "Prestige"], engineSizes: ["2.0L Turbo I4"] },
    ]},
  { make: "Lexus", count: 1, models: [
      { model: "RX", bodyType: "SUV", fuelTypes: ["Hybrid", "Petrol"], priceRange: [42000, 62000], trims: ["350", "450h+"], engineSizes: ["2.4L Turbo I4"] },
      { model: "ES", bodyType: "Luxury", fuelTypes: ["Hybrid", "Petrol"], priceRange: [36000, 52000], trims: ["250", "350"], engineSizes: ["2.5L I4"] },
    ]},
  { make: "Hyundai", count: 1, models: [
      { model: "Ioniq 5", bodyType: "Electric", fuelTypes: ["Electric"], priceRange: [32000, 48000], trims: ["SE", "Limited"], engineSizes: ["Single Motor RWD", "Dual Motor AWD"] },
      { model: "Tucson", bodyType: "SUV", fuelTypes: ["Hybrid", "Petrol"], priceRange: [26000, 38000], trims: ["SEL", "Limited"], engineSizes: ["1.6L Turbo I4"] },
    ]},
  { make: "Chevrolet", count: 1, models: [
      { model: "Silverado", bodyType: "Truck", fuelTypes: ["Petrol", "Diesel"], priceRange: [36000, 58000], trims: ["LT", "LTZ"], engineSizes: ["5.3L V8"] },
      { model: "Equinox", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [24000, 34000], trims: ["LT", "RS"], engineSizes: ["1.5L Turbo I4"] },
    ]},
  { make: "Kia", count: 1, models: [
      { model: "Sportage", bodyType: "SUV", fuelTypes: ["Hybrid", "Petrol"], priceRange: [26000, 38000], trims: ["LX", "GT-Line"], engineSizes: ["1.6L Turbo I4"] },
      { model: "Sorento", bodyType: "SUV", fuelTypes: ["Hybrid", "Petrol"], priceRange: [30000, 42000], trims: ["EX", "SX"], engineSizes: ["2.5L I4"] },
    ]},
  { make: "Mazda", count: 1, models: [
      { model: "CX-5", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [24000, 36000], trims: ["Touring", "Grand Touring"], engineSizes: ["2.5L I4"] },
      { model: "CX-30", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [22000, 32000], trims: ["Select", "Premium"], engineSizes: ["2.5L I4"] },
    ]},
  { make: "Volkswagen", count: 1, models: [
      { model: "Tiguan", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [26000, 38000], trims: ["SE", "R-Line"], engineSizes: ["2.0L Turbo I4"] },
      { model: "Passat", bodyType: "Sedan", fuelTypes: ["Petrol"], priceRange: [24000, 34000], trims: ["SE", "SEL"], engineSizes: ["2.0L Turbo I4"] },
    ]},
  { make: "Nissan", count: 1, models: [
      { model: "Patrol", bodyType: "SUV", fuelTypes: ["Petrol", "Diesel"], priceRange: [52000, 78000], trims: ["SE", "Platinum"], engineSizes: ["5.6L V8"] },
      { model: "X-Trail", bodyType: "SUV", fuelTypes: ["Petrol", "Hybrid"], priceRange: [26000, 38000], trims: ["SV", "SL"], engineSizes: ["2.5L I4"] },
    ]},
  { make: "Land Rover", count: 1, models: [
      { model: "Range Rover Sport", bodyType: "Luxury", fuelTypes: ["Petrol", "Hybrid"], priceRange: [68000, 98000], trims: ["Dynamic SE", "Autobiography"], engineSizes: ["3.0L Turbo I6"] },
      { model: "Discovery", bodyType: "SUV", fuelTypes: ["Petrol", "Diesel"], priceRange: [52000, 72000], trims: ["S", "HSE"], engineSizes: ["3.0L Turbo I6"] },
    ]},
  { make: "Porsche", count: 1, models: [
      { model: "Cayenne", bodyType: "Luxury", fuelTypes: ["Petrol", "Hybrid"], priceRange: [72000, 110000], trims: ["S", "GTS"], engineSizes: ["2.9L Twin-Turbo V6"] },
      { model: "Macan", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [58000, 82000], trims: ["S", "GTS"], engineSizes: ["2.0L Turbo I4"] },
    ]},
  { make: "Subaru", count: 1, models: [
      { model: "Outback", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [28000, 40000], trims: ["Premium", "Limited"], engineSizes: ["2.5L Boxer I4"] },
      { model: "Forester", bodyType: "SUV", fuelTypes: ["Petrol"], priceRange: [26000, 36000], trims: ["Sport", "Touring"], engineSizes: ["2.5L Boxer I4"] },
    ]},
  { make: "Isuzu", count: 1, models: [
      { model: "D-Max", bodyType: "Truck", fuelTypes: ["Diesel"], priceRange: [26000, 38000], trims: ["LS", "LS-T"], engineSizes: ["3.0L Turbo Diesel"] },
    ]},
  { make: "Ram", count: 1, models: [
      { model: "1500", bodyType: "Truck", fuelTypes: ["Petrol", "Diesel"], priceRange: [38000, 62000], trims: ["Big Horn", "Laramie"], engineSizes: ["5.7L HEMI V8"] },
      { model: "2500", bodyType: "Truck", fuelTypes: ["Diesel"], priceRange: [48000, 72000], trims: ["Laramie", "Limited"], engineSizes: ["6.7L Turbo Diesel"] },
    ]},
];

export function generateInventory(): Vehicle[] {
  const all: Vehicle[] = [];
  let id = 1;

  for (const brand of CHINESE_BRANDS) {
    const batch = generateForBrand(brand, id);
    all.push(...batch);
    id += batch.length;
  }

  for (const brand of INTERNATIONAL_BRANDS) {
    const batch = generateForBrand(brand, id);
    all.push(...batch);
    id += batch.length;
  }

  return all;
}

export function chineseVehicleCount(inventory: Vehicle[]): number {
  return inventory.filter((v) => CHINESE_MAKES.includes(v.make as (typeof CHINESE_MAKES)[number])).length;
}
