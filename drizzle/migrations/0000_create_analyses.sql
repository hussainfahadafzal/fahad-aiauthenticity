CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','audio','text','multimodal')),
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  image_score NUMERIC,
  audio_score NUMERIC,
  text_score NUMERIC,
  final_score NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  risk_level TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_contributions JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  limitations TEXT,
  analyzer_version TEXT NOT NULL DEFAULT '1.0.0',
  scoring_version TEXT NOT NULL DEFAULT '1.0.0',
  processing_time NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO authenticated;
GRANT ALL ON public.analyses TO service_role;

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analyses are readable by everyone" ON public.analyses FOR SELECT USING (true);
CREATE POLICY "Anyone can create analyses" ON public.analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete analyses" ON public.analyses FOR DELETE USING (true);

CREATE INDEX analyses_created_at_idx ON public.analyses (created_at DESC);
CREATE INDEX analyses_media_type_idx ON public.analyses (media_type);