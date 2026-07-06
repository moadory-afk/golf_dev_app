// supabase.js
// Supabase client for cleanup script (CommonJS)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mmovqqtwgjfhxhwkqycp.supabase.co', // ← 실제 Supabase URL 로 교체
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tb3ZxcXR3Z2pmaHhod2txeWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzQ5MTgsImV4cCI6MjA5NzgxMDkxOH0.Cb86uO28nT2W2MZwts0vpPONUQEpI0sGQGmUHPyKea8'                     // ← 실제 anon key 로 교체
);

module.exports = { supabase };