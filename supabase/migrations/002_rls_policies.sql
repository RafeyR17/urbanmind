-- RLS for client-side anon access (history panel + post-simulation saves)

ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_simulation_runs"
  ON simulation_runs
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon_insert_simulation_runs"
  ON simulation_runs
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon_update_simulation_runs"
  ON simulation_runs
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Scenarios are read-only from the client (seed data)
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_scenarios"
  ON scenarios
  FOR SELECT
  TO anon
  USING (true);
