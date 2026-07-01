-- Differentiate corporate homepage testimonial names from auto division defaults.
-- Only renames items that still use the auto-division duplicate names.

UPDATE site_content
SET
  content = jsonb_set(
    content,
    '{items}',
    (
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN elem->>'name' = 'Kwame Asante' THEN jsonb_set(elem, '{name}', '"Samuel Boateng"')
            WHEN elem->>'name' = 'Ama Osei' THEN jsonb_set(elem, '{name}', '"Grace Adjei"')
            WHEN elem->>'name' = 'David Martinez' THEN jsonb_set(elem, '{name}', '"Emmanuel Darko"')
            WHEN elem->>'name' = 'Jennifer Mensah' THEN jsonb_set(elem, '{name}', '"Patricia Owusu"')
            ELSE elem
          END
          ORDER BY ord
        ),
        content->'items'
      )
      FROM jsonb_array_elements(content->'items') WITH ORDINALITY AS t(elem, ord)
    )
  ),
  updated_at = NOW()
WHERE section = 'corporate_testimonials'
  AND jsonb_typeof(content->'items') = 'array'
  AND content->'items' @> ANY (
    ARRAY[
      '[{"name": "Kwame Asante"}]'::jsonb,
      '[{"name": "Ama Osei"}]'::jsonb,
      '[{"name": "David Martinez"}]'::jsonb,
      '[{"name": "Jennifer Mensah"}]'::jsonb
    ]
  );
