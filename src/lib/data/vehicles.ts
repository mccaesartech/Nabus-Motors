import "server-only";
import type { Category, Testimonial, Vehicle } from "@/lib/types";
import {
  CHINESE_MAKES,
  chineseVehicleCount,
  generateInventory,
} from "./generate-inventory";
import { PLACEHOLDER_IMAGE } from "./vehicle-images";

export const vehicles = generateInventory();

function pickImage(
  list: Vehicle[],
  match: (v: Vehicle) => boolean
): string {
  return list.find(match)?.images[0] ?? PLACEHOLDER_IMAGE;
}

export const vehicleImages = {
  suv: pickImage(vehicles, (v) => v.bodyType === "SUV"),
  sedan: pickImage(vehicles, (v) => v.bodyType === "Sedan"),
  luxury: pickImage(vehicles, (v) => v.bodyType === "Luxury"),
  truck: pickImage(vehicles, (v) => v.bodyType === "Truck"),
  commercial: pickImage(vehicles, (v) => v.bodyType === "Commercial"),
  electric: pickImage(
    vehicles,
    (v) => v.bodyType === "Electric" || v.fuelType === "Electric"
  ),
  hero: pickImage(vehicles, (v) => v.make === "BYD" && v.featured),
  chinese: pickImage(vehicles, (v) => v.make === "BYD"),
  portrait1: pickImage(vehicles, (v) => v.make === "BYD" && v.bodyType === "SUV"),
  portrait2: pickImage(vehicles, (v) => v.make === "BYD" && v.bodyType === "Sedan"),
  portrait3: pickImage(vehicles, (v) => v.make === "Ford"),
  portrait4: pickImage(vehicles, (v) => v.make === "Toyota"),
  showroom: pickImage(vehicles, (v) => v.make === "Lexus"),
  workshop: pickImage(vehicles, (v) => v.make === "Honda"),
} as const;

export const categories: Category[] = [
  {
    id: "suv",
    name: "SUVs",
    slug: "SUV",
    count: vehicles.filter((v) => v.bodyType === "SUV").length,
    image: vehicleImages.suv,
  },
  {
    id: "sedan",
    name: "Sedans",
    slug: "Sedan",
    count: vehicles.filter((v) => v.bodyType === "Sedan").length,
    image: vehicleImages.sedan,
  },
  {
    id: "luxury",
    name: "Luxury Vehicles",
    slug: "Luxury",
    count: vehicles.filter((v) => v.bodyType === "Luxury").length,
    image: vehicleImages.luxury,
  },
  {
    id: "truck",
    name: "Trucks",
    slug: "Truck",
    count: vehicles.filter((v) => v.bodyType === "Truck").length,
    image: vehicleImages.truck,
  },
  {
    id: "commercial",
    name: "Commercial Vehicles",
    slug: "Commercial",
    count: vehicles.filter((v) => v.bodyType === "Commercial").length,
    image: vehicleImages.commercial,
  },
  {
    id: "electric",
    name: "Electric Vehicles",
    slug: "Electric",
    count: vehicles.filter(
      (v) => v.bodyType === "Electric" || v.fuelType === "Electric"
    ).length,
    image: vehicleImages.electric,
    href: "/auto/inventory?fuelType=Electric",
  },
  {
    id: "chinese",
    name: "Chinese Brands",
    slug: "SUV",
    count: chineseVehicleCount(vehicles),
    image: vehicleImages.chinese,
    href: "/auto/inventory?chinese=1",
  },
];

export const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Kwame Asante",
    location: "Accra, Ghana",
    vehicle: "2024 BYD Atto 3",
    rating: 5,
    quote:
      "True Goshen made buying my electric SUV straightforward. Transparent pricing, no pressure, and the vehicle was exactly as described. Delivery to Accra was seamless.",
    image: vehicleImages.portrait1,
    verified: true,
  },
  {
    id: "2",
    name: "Ama Osei",
    location: "Kumasi, Ghana",
    vehicle: "2024 BYD Seal",
    rating: 5,
    quote:
      "I appreciated the thorough inspection report and battery health verification. Financing was explained clearly, and I felt confident throughout the entire process.",
    image: vehicleImages.portrait2,
    verified: true,
  },
  {
    id: "3",
    name: "David Martinez",
    location: "Tema, Ghana",
    vehicle: "2023 Ford F-150",
    rating: 5,
    quote:
      "Sold my truck through True Goshen and bought a newer model the same week. Fair appraisal, professional team, and excellent follow-up after the sale.",
    image: vehicleImages.portrait3,
    verified: true,
  },
  {
    id: "4",
    name: "Jennifer Mensah",
    location: "Takoradi, Ghana",
    vehicle: "2023 Geely Coolray",
    rating: 5,
    quote:
      "Nationwide delivery worked perfectly. The car arrived detailed and ready to drive. Customer support answered every question before I committed.",
    image: vehicleImages.portrait4,
    verified: true,
  },
];

export { CHINESE_MAKES };
export { makes, modelsByMake, locations } from "./catalog-meta";
