/** Lightweight filter metadata — safe for client components (no full inventory). */

export const locations = [
  "Accra, Ghana",
  "Kumasi, Ghana",
  "Tema, Ghana",
  "Takoradi, Ghana",
  "Cape Coast, Ghana",
] as const;

const MODELS_BY_MAKE: Record<string, string[]> = {
  BYD: ["Atto 3", "Seal", "Dolphin", "Song Plus", "Tang", "Han", "Yuan Plus"],
  Geely: ["Coolray", "Monjaro", "Emgrand"],
  Chery: ["Tiggo 8 Pro", "Tiggo 7 Pro", "Omoda 5", "Omoda E5"],
  MG: ["ZS EV", "HS", "4 EV"],
  Haval: ["H6", "Jolion"],
  Changan: ["CS75 Plus", "UNI-K", "Eado Plus"],
  GWM: ["Ora 03", "Tank 300", "Poer", "Cannon Alpha"],
  Jetour: ["X70 Plus", "Dashing"],
  DFSK: ["Glory 580"],
  BAIC: ["BJ40 Plus"],
  "Lynk & Co": ["01"],
  XPeng: ["P7", "G9"],
  NIO: ["ES6", "ET5"],
  Hongqi: ["H9", "E-HS9"],
  Zeekr: ["001"],
  "Li Auto": ["L7", "L9"],
  Aion: ["Y Plus"],
  Wuling: ["Air EV"],
  Voyah: ["Free"],
  Denza: ["D9"],
  BMW: ["X5", "3 Series", "X3"],
  "Mercedes-Benz": ["E-Class", "GLC", "C-Class"],
  Toyota: ["Camry", "RAV4", "Hilux"],
  Honda: ["CR-V", "Accord", "Civic"],
  Ford: ["F-150", "Explorer", "Mustang Mach-E"],
  Audi: ["Q5", "A4", "Q7"],
  Lexus: ["RX", "ES", "NX"],
  Tesla: ["Model 3", "Model Y", "Model X"],
  Hyundai: ["Tucson", "Santa Fe", "Elantra"],
  Kia: ["Sportage", "Sorento", "K5"],
  Volkswagen: ["Tiguan", "Passat"],
  Nissan: ["Patrol", "X-Trail"],
  "Land Rover": ["Range Rover Sport", "Discovery"],
  Porsche: ["Cayenne", "Macan"],
  Subaru: ["Outback", "Forester"],
  Isuzu: ["D-Max"],
  Ram: ["1500", "2500"],
};

export const makes = Object.keys(MODELS_BY_MAKE).sort();

export const modelsByMake = MODELS_BY_MAKE;
