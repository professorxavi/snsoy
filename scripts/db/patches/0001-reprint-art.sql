-- Reprint art: give a creature the illustration from another printing of itself.
--
-- 46 creatures are reprinted in a second book where the upstream data attached
-- `fluff.images` to only one of the two printings. The stat block, the lore and
-- the name all came across; the pictures did not. Two URLs for the identical
-- creature therefore render differently -- /monsters/mtf/molydeus shows a token,
-- /monsters/mpmm/molydeus shows a full plate.
--
-- Applied to the loaded database and then dumped, which is how the README says a
-- derived seed is produced: "strip the loaded database rather than re-ingest, so
-- the public seed is structurally identical to the full one". Ingest is not
-- re-run.
--
-- The pairs are spelled out rather than joined on name at run time, on purpose:
-- the donor is a curated choice, not a derivable one. Name matching alone gives
-- WDMM's Large Mimic the art from RMBRE (the Rick and Morty crossover book),
-- whose "illustration" is the book's intro splash. That one is redirected to the
-- Monster Manual's Mimic by hand -- it is the only pair whose donor is not the
-- same creature under the same name.
--
-- Five pairs are rebalanced rather than straight reprints -- Amphisbaena, Brain
-- in a Jar, Darathra Shendrel, Ice Troll and Large Mimic differ in CR, size or
-- hit points between printings. All five were reviewed and accepted: they are
-- the same creature at a different power level, and Darathra is a named NPC.
--
-- Idempotent: only writes where the target still has no images.

BEGIN;

CREATE TEMP TABLE reprint_art (gap text, donor text) ON COMMIT DROP;

INSERT INTO reprint_art (gap, donor) VALUES
  ('monster|amphisbaena|tftyp', 'monster|amphisbaena|gos'),
  ('monster|archdruid|vgm', 'monster|archdruid|mpmm'),
  ('monster|ash zombie|lmop', 'monster|ash zombie|pabtso'),
  ('monster|bel|coa', 'monster|bel|bgdia'),
  ('monster|blackguard|vgm', 'monster|blackguard|mpmm'),
  ('monster|brain in a jar|llk', 'monster|brain in a jar|vrgr'),
  ('monster|brontosaurus|mpmm', 'monster|brontosaurus|vgm'),
  ('monster|darathra shendrel|pota', 'monster|darathra shendrel|skt'),
  ('monster|deep rothé|vgm', 'monster|deep rothé|mpmm'),
  ('monster|dolphin|vgm', 'monster|dolphin|mpmm'),
  ('monster|drow favored consort|mtf', 'monster|drow favored consort|mpmm'),
  ('monster|drow house captain|mtf', 'monster|drow house captain|mpmm'),
  ('monster|drow inquisitor|mtf', 'monster|drow inquisitor|mpmm'),
  ('monster|drow shadowblade|mtf', 'monster|drow shadowblade|mpmm'),
  ('monster|duergar soulblade|mtf', 'monster|duergar soulblade|mpmm'),
  ('monster|duergar warlord|mtf', 'monster|duergar warlord|mpmm'),
  ('monster|duergar xarrorn|mtf', 'monster|duergar xarrorn|mpmm'),
  ('monster|eidolon|mtf', 'monster|eidolon|mpmm'),
  ('monster|female steeder|oota', 'monster|female steeder|mpmm'),
  ('monster|firenewt warlock of imix|mpmm', 'monster|firenewt warlock of imix|vgm'),
  ('monster|guard drake|hotdq', 'monster|guard drake|mpmm'),
  ('monster|gundren rockseeker|lmop', 'monster|gundren rockseeker|pabtso'),
  ('monster|ice troll|rot', 'monster|ice troll|idrotf'),
  ('monster|large mimic|wdmm', 'monster|mimic|mm'),
  ('monster|male steeder|mpmm', 'monster|male steeder|mtf'),
  ('monster|male steeder|oota', 'monster|male steeder|mtf'),
  ('monster|martial arts adept|vgm', 'monster|martial arts adept|mpmm'),
  ('monster|medusa|mot', 'monster|medusa|mm'),
  ('monster|molydeus|mtf', 'monster|molydeus|mpmm'),
  ('monster|neogi master|mpmm', 'monster|neogi master|vgm'),
  ('monster|nundro rockseeker|lmop', 'monster|nundro rockseeker|pabtso'),
  ('monster|redbrand ruffian|lmop', 'monster|redbrand ruffian|pabtso'),
  ('monster|sildar hallwinter|lmop', 'monster|sildar hallwinter|pabtso'),
  ('monster|star spawn grue|mtf', 'monster|star spawn grue|mpmm'),
  ('monster|star spawn hulk|mtf', 'monster|star spawn hulk|mpmm'),
  ('monster|star spawn mangler|mtf', 'monster|star spawn mangler|mpmm'),
  ('monster|star spawn seer|mtf', 'monster|star spawn seer|mpmm'),
  ('monster|swarm of rot grubs|vgm', 'monster|swarm of rot grubs|mpmm'),
  ('monster|sword wraith commander|mpmm', 'monster|sword wraith commander|mtf'),
  ('monster|tortle druid|mpmm', 'monster|tortle druid|mtf'),
  ('monster|vegepygmy|mpmm', 'monster|vegepygmy|vgm'),
  ('monster|war priest|vgm', 'monster|war priest|mpmm'),
  ('monster|warlock of the fiend|mpmm', 'monster|warlock of the fiend|vgm'),
  ('monster|warlock of the great old one|vgm', 'monster|warlock of the great old one|mpmm'),
  ('monster|warlord|vgm', 'monster|warlord|mpmm'),
  ('monster|zariel|coa', 'monster|zariel|mpmm');

-- Guards. A seed re-cut upstream could invalidate either side of a pair, and a
-- silent no-op would be worse than a failure: the creature would keep its token
-- and nothing would say why.
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM reprint_art r
  LEFT JOIN entities d ON d.natural_key = r.donor
  WHERE d.id IS NULL OR coalesce(jsonb_array_length(d.fluff->'images'), 0) = 0;
  IF bad > 0 THEN
    RAISE EXCEPTION 'reprint_art: % donor(s) missing or carrying no images', bad;
  END IF;

  SELECT count(*) INTO bad
  FROM reprint_art r
  LEFT JOIN entities g ON g.natural_key = r.gap
  WHERE g.id IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'reprint_art: % target(s) not found', bad;
  END IF;
END $$;

UPDATE entities g
SET fluff = jsonb_set(coalesce(g.fluff, '{}'::jsonb), '{images}', d.fluff->'images')
FROM reprint_art r
JOIN entities d ON d.natural_key = r.donor
WHERE g.natural_key = r.gap
  AND coalesce(jsonb_array_length(g.fluff->'images'), 0) = 0;

COMMIT;
