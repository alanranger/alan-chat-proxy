-- Additive: product reviews + page slug catalog (applied via Supabase MCP 2026-06-02)
-- See scripts/ingest-product-reviews.mjs to reload from CSV

CREATE TABLE IF NOT EXISTS public.page_slug_catalog (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug text NOT NULL,
  slug_key text NOT NULL,
  url text NOT NULL,
  category text,
  page_type text,
  target_keyword text,
  product_title text,
  catalog_source text NOT NULL DEFAULT 'canonical_products',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_slug_catalog_slug_key_unique UNIQUE (slug_key)
);

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_review_id text,
  reviewer_name text NOT NULL,
  review_date date,
  rating integer,
  quote text NOT NULL,
  source text,
  product_slug text NOT NULL,
  url text,
  category text,
  page_type text,
  target_keyword text,
  is_verified boolean NOT NULL DEFAULT false,
  is_excluded boolean NOT NULL DEFAULT false,
  exclude_reason text,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_reviews_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  CONSTRAINT product_reviews_source_id_slug_unique UNIQUE (source_review_id, product_slug)
);

CREATE OR REPLACE VIEW public.product_reviews_top3 AS
SELECT
  id, source_review_id, reviewer_name, review_date, rating, quote, source,
  product_slug, url, category, page_type, target_keyword, is_verified, rn AS review_rank
FROM (
  SELECT pr.*,
    ROW_NUMBER() OVER (
      PARTITION BY pr.product_slug
      ORDER BY pr.review_date DESC NULLS LAST, pr.rating DESC NULLS LAST, pr.id DESC
    ) AS rn
  FROM public.product_reviews pr
  WHERE pr.is_excluded = false AND pr.rating = 5
    AND pr.quote IS NOT NULL AND length(trim(pr.quote)) > 20
) ranked
WHERE rn <= 3;
