-- Extensions required by the content search layer.
-- pg_trgm powers fuzzy name matching; unaccent normalises accented entity names
-- (e.g. "Deva" vs "Dévá") so search behaves predictably.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
