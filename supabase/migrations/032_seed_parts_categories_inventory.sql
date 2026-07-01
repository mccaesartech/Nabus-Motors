-- Seed auto parts categories and sample inventory (idempotent)
-- Run after 028_company_expansion_foundation.sql

-- Deactivate legacy combined categories from 028 in favour of granular taxonomy
UPDATE parts_categories
SET is_active = false, updated_at = NOW()
WHERE slug IN (
  'engine-drivetrain',
  'brakes-suspension',
  'electrical-lighting',
  'body-exterior',
  'interior-comfort',
  'filters-fluids'
);

-- ─── Categories (12 per product spec) ───────────────────────────────────────────
INSERT INTO parts_categories (name, slug, description, sort_order) VALUES
  ('Engine', 'engine', 'Engine blocks, gaskets, belts, and internal components', 1),
  ('Transmission', 'transmission', 'Gearboxes, clutches, torque converters, and drivetrain', 2),
  ('Suspension', 'suspension', 'Shocks, struts, control arms, and bushings', 3),
  ('Electrical', 'electrical', 'Alternators, starters, wiring, and sensors', 4),
  ('Body Parts', 'body-parts', 'Panels, bumpers, fenders, and structural body components', 5),
  ('Tyres', 'tyres', 'Passenger, SUV, and commercial tyres', 6),
  ('Interior', 'interior', 'Seats, dashboards, trim, and cabin fittings', 7),
  ('Exterior', 'exterior', 'Mirrors, grilles, spoilers, and exterior trim', 8),
  ('Accessories', 'accessories', 'Mats, covers, racks, and convenience add-ons', 9),
  ('Lubricants', 'lubricants', 'Engine oils, gear oils, and specialty fluids', 10),
  ('Filters', 'filters', 'Oil, air, fuel, and cabin air filters', 11),
  ('Batteries', 'batteries', 'Starter batteries and AGM units for all vehicle types', 12)
ON CONFLICT (slug) DO NOTHING;

-- ─── Sample parts (16 total: 12 draft, 4 published) ───────────────────────────
INSERT INTO parts (
  category_id, name, slug, sku, description, price_usd, brand,
  compatible_makes, compatible_models, stock_quantity, status, is_featured
) VALUES
  (
    (SELECT id FROM parts_categories WHERE slug = 'engine'),
    'Toyota 2GR-FE Timing Chain Kit',
    'toyota-2gr-fe-timing-chain-kit',
    '13540-31020',
    'OEM-spec timing chain kit with guides and tensioner. New condition.',
    285, 'Toyota Genuine',
    ARRAY['Toyota'], ARRAY['Camry', 'Highlander', 'RAV4'],
    4, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'engine'),
    'Honda K20 Engine Mount Set',
    'honda-k20-engine-mount-set',
    '50820-SNA-A03',
    'Front and rear engine mounts for K-series engines. Remanufactured, tested.',
    120, 'Honda',
    ARRAY['Honda'], ARRAY['Civic', 'Accord', 'CR-V'],
    8, 'published', true
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'transmission'),
    'Toyota A340E Transmission Filter Kit',
    'toyota-a340e-transmission-filter-kit',
    '35330-60030',
    'Transmission filter and pan gasket for A340E automatic gearbox. New.',
    45, 'Toyota Genuine',
    ARRAY['Toyota'], ARRAY['Land Cruiser', 'Prado', 'Hilux'],
    12, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'suspension'),
    'Monroe Front Strut Assembly',
    'monroe-front-strut-assembly',
    'G7392',
    'Complete front strut with coil spring. New OEM-quality replacement.',
    165, 'Monroe',
    ARRAY['Toyota', 'Nissan'], ARRAY['Corolla', 'Altima', 'Sentra'],
    6, 'published', true
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'suspension'),
    'KYB Rear Shock Absorber',
    'kyb-rear-shock-absorber',
    '349105',
    'Gas-charged rear shock absorber. New, 1-year warranty.',
    78, 'KYB',
    ARRAY['Honda', 'Toyota'], ARRAY['Civic', 'Corolla'],
    10, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'electrical'),
    'Denso 12V 120A Alternator',
    'denso-12v-120a-alternator',
    '104210-5201',
    'High-output alternator for 2.0–2.4L petrol engines. Remanufactured.',
    195, 'Denso',
    ARRAY['Toyota', 'Honda'], ARRAY['Camry', 'Accord'],
    3, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'electrical'),
    'Bosch H4 Halogen Headlight Bulb Pair',
    'bosch-h4-halogen-headlight-bulb-pair',
    '1987302041',
    'Standard H4 halogen bulbs, 60/55W. New in retail pack.',
    18, 'Bosch',
    ARRAY['Toyota', 'Nissan', 'Honda'], ARRAY['Corolla', 'Sentra', 'Civic'],
    24, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'body-parts'),
    'Toyota Corolla Front Bumper Cover',
    'toyota-corolla-front-bumper-cover',
    '52119-02F90',
    'Primed front bumper cover, ready for paint. New aftermarket.',
    220, 'Toyota',
    ARRAY['Toyota'], ARRAY['Corolla'],
    2, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'tyres'),
    'Michelin Primacy 4 205/55 R16',
    'michelin-primacy-4-205-55-r16',
    '205/55R16-91V',
    'All-season touring tyre. New, DOT within 12 months.',
    145, 'Michelin',
    ARRAY['Toyota', 'Honda', 'Nissan'], ARRAY['Corolla', 'Civic', 'Altima'],
    16, 'published', true
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'interior'),
    'Universal Leather Seat Cover Set',
    'universal-leather-seat-cover-set',
    'TG-INT-SC-001',
    '5-piece PU leather seat cover set, black. New.',
    95, 'True Goshen',
    ARRAY['Toyota', 'Honda', 'Nissan'], ARRAY['Corolla', 'Civic', 'Sentra'],
    15, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'exterior'),
    'LED Headlight Assembly Pair',
    'led-headlight-assembly-pair',
    'TG-EXT-HL-002',
    'Aftermarket LED projector headlight assemblies. New.',
    380, 'Depo',
    ARRAY['Toyota'], ARRAY['RAV4', 'Highlander'],
    4, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'accessories'),
    'All-Weather Rubber Floor Mat Set',
    'all-weather-rubber-floor-mat-set',
    'TG-ACC-FM-003',
    '4-piece heavy-duty rubber floor mats, universal fit. New.',
    42, 'True Goshen',
    ARRAY['Toyota', 'Honda', 'Nissan'], ARRAY['Corolla', 'Civic', 'Sentra'],
    30, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'lubricants'),
    'Castrol Edge 5W-30 Engine Oil 5L',
    'castrol-edge-5w30-engine-oil-5l',
    '15B1E5',
    'Full synthetic 5W-30 engine oil, 5-litre bottle. New.',
    52, 'Castrol',
    ARRAY['Toyota', 'Honda', 'Mercedes-Benz'], ARRAY['Camry', 'Civic', 'C-Class'],
    40, 'published', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'filters'),
    'Bosch Oil Filter P7024',
    'bosch-oil-filter-p7024',
    'P7024',
    'Spin-on oil filter for 4-cylinder petrol engines. New.',
    12, 'Bosch',
    ARRAY['Toyota', 'Honda'], ARRAY['Corolla', 'Civic', 'Camry'],
    50, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'filters'),
    'K&N High-Flow Air Filter',
    'kn-high-flow-air-filter',
    '33-2304',
    'Washable high-flow air filter, direct replacement. New.',
    68, 'K&N',
    ARRAY['Toyota'], ARRAY['Land Cruiser', 'Prado'],
    7, 'draft', false
  ),
  (
    (SELECT id FROM parts_categories WHERE slug = 'batteries'),
    'Exide 12V 70Ah Maintenance-Free Battery',
    'exide-12v-70ah-maintenance-free-battery',
    'EB704',
    'Maintenance-free calcium battery, 70Ah / 640CCA. New with 18-month warranty.',
    135, 'Exide',
    ARRAY['Toyota', 'Nissan', 'Honda'], ARRAY['Corolla', 'Altima', 'CR-V'],
    9, 'draft', false
  )
ON CONFLICT (slug) DO NOTHING;
