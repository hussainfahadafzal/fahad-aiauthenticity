ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS image_model_name TEXT,
  ADD COLUMN IF NOT EXISTS image_model_version TEXT,
  ADD COLUMN IF NOT EXISTS image_prediction TEXT,
  ADD COLUMN IF NOT EXISTS image_ai_probability NUMERIC,
  ADD COLUMN IF NOT EXISTS image_model_status TEXT,
  ADD COLUMN IF NOT EXISTS audio_model_name TEXT,
  ADD COLUMN IF NOT EXISTS audio_model_version TEXT,
  ADD COLUMN IF NOT EXISTS audio_prediction TEXT,
  ADD COLUMN IF NOT EXISTS audio_spoof_probability NUMERIC,
  ADD COLUMN IF NOT EXISTS audio_model_status TEXT,
  ADD COLUMN IF NOT EXISTS model_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_model_meta JSONB,
  ADD COLUMN IF NOT EXISTS audio_model_meta JSONB;

CREATE INDEX IF NOT EXISTS analyses_image_model_status_idx ON public.analyses (image_model_status);
CREATE INDEX IF NOT EXISTS analyses_audio_model_status_idx ON public.analyses (audio_model_status);