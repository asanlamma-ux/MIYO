-- Supabase Database Setup for Miyo EPUB Reader
-- Run this in your Supabase SQL Editor
-- https://app.supabase.com/project/YOUR_PROJECT/sql

-- ============================================
-- Community Term Groups Table
-- ============================================
CREATE TABLE IF NOT EXISTS community_term_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  terms JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  downloads INTEGER DEFAULT 0,
  is_official BOOLEAN DEFAULT FALSE
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_community_term_groups_tags ON community_term_groups USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_community_term_groups_downloads ON community_term_groups(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_community_term_groups_official ON community_term_groups(is_official) WHERE is_official = TRUE;
CREATE INDEX IF NOT EXISTS idx_community_term_groups_created_at ON community_term_groups(created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE community_term_groups ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read community term groups
CREATE POLICY "Anyone can view community term groups"
  ON community_term_groups
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Authenticated users can create term groups"
  ON community_term_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = created_by);

-- Allow users to update their own groups
CREATE POLICY "Users can update their own term groups"
  ON community_term_groups
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = created_by);

-- Allow anyone to increment downloads
CREATE POLICY "Anyone can increment downloads"
  ON community_term_groups
  FOR UPDATE
  USING (true);

-- ============================================
-- Community Dictionaries Table
-- Downloadable offline dictionaries for the reader.
-- ============================================
CREATE TABLE IF NOT EXISTS community_dictionaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  language TEXT DEFAULT 'en',
  version TEXT DEFAULT '1.0.0',
  tags TEXT[] DEFAULT '{}',
  entries JSONB DEFAULT '[]'::jsonb,
  entries_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_dictionaries_downloads ON community_dictionaries(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_community_dictionaries_tags ON community_dictionaries USING GIN(tags);

ALTER TABLE community_dictionaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dictionaries"
  ON community_dictionaries
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update dictionary downloads"
  ON community_dictionaries
  FOR UPDATE
  USING (true);

-- ============================================
-- Insert Pre-made Official Term Groups
-- ============================================
-- Note: Replace the terms array with actual terms for each novel

-- Example: Generic MTL Terms
INSERT INTO community_term_groups (name, description, terms, tags, is_official) VALUES
(
  'Generic MTL Corrections',
  'Common machine translation corrections for Chinese web novels. Fixes common MTL errors like name formats, cultivation terms, and idioms.',
  '[
    {"id": "t_001", "originalText": "fellow daoist", "correctedText": "Daoist Friend", "context": "Cultivation term"},
    {"id": "t_002", "originalText": "senior brother", "correctedText": "Senior Martial Brother", "context": "Sect hierarchy"},
    {"id": "t_003", "originalText": "junior brother", "correctedText": "Junior Martial Brother", "context": "Sect hierarchy"},
    {"id": "t_004", "originalText": "elder brother", "correctedText": "Older Brother", "context": "Family term"},
    {"id": "t_005", "originalText": "younger sister", "correctedText": "Little Sister", "context": "Family term"},
    {"id": "t_006", "originalText": "young master", "correctedText": "Young Master", "context": "Noble title"},
    {"id": "t_007", "originalText": "old monster", "correctedText": "Old Monster", "context": "Cultivation term"},
    {"id": "t_008", "originalText": "heavenly dao", "correctedText": "Heavenly Dao", "context": "Cultivation cosmology"},
    {"id": "t_009", "originalText": "qi condensation", "correctedText": "Qi Condensation", "context": "Cultivation realm"},
    {"id": "t_010", "originalText": "foundation establishment", "correctedText": "Foundation Establishment", "context": "Cultivation realm"}
  ]'::jsonb,
  ARRAY['mtl', 'chinese', 'cultivation', 'generic'],
  TRUE
),
(
  'Korean Novel Terms',
  'Common corrections for Korean web novel machine translations. Fixes honorifics, titles, and common terms.',
  '[
    {"id": "t_011", "originalText": "hyung", "correctedText": "Hyung-nim", "context": "Korean honorific"},
    {"id": "t_012", "originalText": "noona", "correctedText": "Noona", "context": "Korean honorific"},
    {"id": "t_013", "originalText": "oppa", "correctedText": "Oppa", "context": "Korean honorific"},
    {"id": "t_014", "originalText": "sunbae", "correctedText": "Sunbae-nim", "context": "Korean senior"},
    {"id": "t_015", "originalText": "hoobae", "correctedText": "Hoobae", "context": "Korean junior"}
  ]'::jsonb,
  ARRAY['mtl', 'korean', 'honorifics'],
  TRUE
),
(
  'Japanese Novel Terms',
  'Common corrections for Japanese light novel machine translations.',
  '[
    {"id": "t_016", "originalText": "senpai", "correctedText": "Senpai", "context": "Japanese honorific"},
    {"id": "t_017", "originalText": "kouhai", "correctedText": "Kouhai", "context": "Japanese junior"},
    {"id": "t_018", "originalText": "sensei", "correctedText": "Sensei", "context": "Japanese teacher/master"},
    {"id": "t_019", "originalText": "oniisan", "correctedText": "Onii-san", "context": "Japanese older brother"},
    {"id": "t_020", "originalText": "oneesan", "correctedText": "Onee-san", "context": "Japanese older sister"}
  ]'::jsonb,
  ARRAY['mtl', 'japanese', 'light-novel'],
  TRUE
);

-- ============================================
-- Downloadable Offline Dictionaries
-- ============================================
INSERT INTO community_dictionaries (name, description, language, version, tags, entries, entries_count) VALUES
(
  'Web Novel Glossary',
  'Offline definitions for common xianxia, wuxia, light-novel, and honorific terms used in web fiction.',
  'en',
  '1.0.0',
  ARRAY['webnovel', 'xianxia', 'wuxia', 'honorifics'],
  '[
    {"term":"dao", "definition":"The Way; a philosophical or cosmic principle central to Daoist thought and many cultivation novels.", "partOfSpeech":"noun", "aliases":["大道"]},
    {"term":"qi", "definition":"Vital energy or life force cultivated through martial or spiritual practice.", "partOfSpeech":"noun", "aliases":["chi"]},
    {"term":"dantian", "definition":"An energy center in the body where qi is stored and refined.", "partOfSpeech":"noun"},
    {"term":"senpai", "definition":"A senior member in school, work, or a group, especially in Japanese usage.", "partOfSpeech":"noun"},
    {"term":"young master", "definition":"The privileged son of a wealthy or powerful family, common in translated web novels.", "partOfSpeech":"noun"}
  ]'::jsonb,
  5
),
(
  'Fantasy Creatures Mini Pack',
  'Offline lookup for common fantasy creature names and archetypes.',
  'en',
  '1.0.0',
  ARRAY['fantasy', 'creatures'],
  '[
    {"term":"wyvern", "definition":"A dragon-like creature with two legs and a barbed tail.", "partOfSpeech":"noun"},
    {"term":"lich", "definition":"An undead sorcerer who preserves life through magic and phylactery-like vessels.", "partOfSpeech":"noun"},
    {"term":"griffin", "definition":"A mythical beast with the body of a lion and the head and wings of an eagle.", "partOfSpeech":"noun"}
  ]'::jsonb,
  3
);

-- ============================================
-- Usage Instructions
-- ============================================
-- 1. Replace the example terms with actual term data
-- 2. Add more pre-made groups as needed
-- 3. Users can download these groups from the app
-- 4. Users can also create and share their own groups
-- 5. Official groups are marked with is_official = TRUE
-- 6. The app fetches these via supabase.from('community_term_groups')
