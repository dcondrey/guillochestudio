-- Guilloché Studio Pro - Collaboration Schema
-- Real-time collaborative editing support

-- Collaboration sessions
CREATE TABLE collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE NOT NULL,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_collab_sessions_pattern ON collaboration_sessions(pattern_id);
CREATE INDEX idx_collab_sessions_host ON collaboration_sessions(host_id);
CREATE INDEX idx_collab_sessions_active ON collaboration_sessions(is_active) WHERE is_active = true;

-- Pattern comments
CREATE TABLE pattern_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES collaboration_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  position_x FLOAT,
  position_y FLOAT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_comments_pattern ON pattern_comments(pattern_id);
CREATE INDEX idx_comments_session ON pattern_comments(session_id);
CREATE INDEX idx_comments_user ON pattern_comments(user_id);

-- Comment replies
CREATE TABLE comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES pattern_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_replies_comment ON comment_replies(comment_id);

-- Pattern versions (branching)
CREATE TABLE pattern_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parameters JSONB NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  parent_version_id UUID REFERENCES pattern_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_versions_pattern ON pattern_versions(pattern_id);
CREATE INDEX idx_versions_parent ON pattern_versions(parent_version_id);
CREATE INDEX idx_versions_created ON pattern_versions(created_at DESC);

-- Enable RLS
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collaboration_sessions
CREATE POLICY "Users can view sessions for patterns they have access to"
  ON collaboration_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patterns
      WHERE patterns.id = collaboration_sessions.pattern_id
      AND (patterns.is_public = true OR patterns.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create sessions for their own patterns"
  ON collaboration_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their sessions"
  ON collaboration_sessions FOR UPDATE
  USING (auth.uid() = host_id);

-- RLS Policies for pattern_comments
CREATE POLICY "Anyone can view comments on public patterns"
  ON pattern_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patterns
      WHERE patterns.id = pattern_comments.pattern_id
      AND (patterns.is_public = true OR patterns.user_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can create comments"
  ON pattern_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON pattern_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for comment_replies
CREATE POLICY "Anyone can view replies"
  ON comment_replies FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create replies"
  ON comment_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for pattern_versions
CREATE POLICY "Users can view versions for accessible patterns"
  ON pattern_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patterns
      WHERE patterns.id = pattern_versions.pattern_id
      AND (patterns.is_public = true OR patterns.user_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can create versions"
  ON pattern_versions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Enable realtime for collaboration tables
ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE pattern_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE comment_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE pattern_versions;
