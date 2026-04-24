CREATE TABLE caffeinated_drinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    drink_type TEXT NOT NULL,
    name TEXT,
    caffeine_mg NUMERIC NOT NULL CHECK (caffeine_mg >= 0 AND caffeine_mg <= 1000),
    consumed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_caffeine_user_consumed ON caffeinated_drinks(user_id, consumed_at DESC);

ALTER TABLE caffeinated_drinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own caffeine intake"
  ON caffeinated_drinks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE caffeinated_drinks;
