-- Freight quote cargo type + size fields

ALTER TABLE freight_quote_requests
  ADD COLUMN IF NOT EXISTS cargo_size TEXT;

COMMENT ON COLUMN freight_quote_requests.cargo_description IS 'Cargo type label or custom description';
COMMENT ON COLUMN freight_quote_requests.cargo_size IS 'Selected size, dimensions, or weight details';

DROP POLICY IF EXISTS "Public operational site_settings are readable" ON site_settings;
CREATE POLICY "Public operational site_settings are readable"
  ON site_settings FOR SELECT
  USING (
    key IN (
      'clearing_fee_notice',
      'preorder_terms_a',
      'preorder_terms_b',
      'preorder_terms_c',
      'maintenance_mode',
      'maintenance_message',
      'freight_default_origins',
      'freight_cargo_options',
      'feature_show_spare_parts_nav',
      'feature_show_freight_nav',
      'phone',
      'email',
      'whatsapp_number',
      'company_name',
      'hours_weekday',
      'hours_saturday',
      'hours_sunday'
    )
  );

INSERT INTO site_settings (key, value) VALUES
  (
    'freight_cargo_options',
    $$[
  {
    "value": "vehicle",
    "label": "Vehicle",
    "sizeLabel": "Vehicle type",
    "sizes": [
      { "value": "sedan", "label": "Sedan" },
      { "value": "suv", "label": "SUV" },
      { "value": "truck", "label": "Truck" },
      { "value": "motorcycle", "label": "Motorcycle" }
    ],
    "detailLabel": "Make / model (optional)",
    "detailPlaceholder": "e.g. 2022 Toyota RAV4"
  },
  {
    "value": "container",
    "label": "Container",
    "sizeLabel": "Container size",
    "sizes": [
      { "value": "20ft", "label": "20ft" },
      { "value": "40ft", "label": "40ft" },
      { "value": "40ft_hc", "label": "40ft HC" }
    ]
  },
  {
    "value": "general_cargo",
    "label": "General cargo",
    "sizeLabel": "Size category",
    "sizes": [
      { "value": "small", "label": "Small" },
      { "value": "medium", "label": "Medium" },
      { "value": "large", "label": "Large" }
    ],
    "detailLabel": "Dimensions or weight estimate (optional)",
    "detailPlaceholder": "e.g. 2×1×1 m or ~500 kg"
  },
  {
    "value": "spare_parts",
    "label": "Spare parts shipment",
    "sizeLabel": "Estimated weight",
    "sizes": [
      { "value": "under_50kg", "label": "Under 50 kg" },
      { "value": "50_200kg", "label": "50–200 kg" },
      { "value": "over_200kg", "label": "Over 200 kg" }
    ]
  },
  {
    "value": "documents",
    "label": "Documents only"
  },
  {
    "value": "custom",
    "label": "Custom",
    "custom": true
  }
]$$
  )
ON CONFLICT (key) DO NOTHING;
