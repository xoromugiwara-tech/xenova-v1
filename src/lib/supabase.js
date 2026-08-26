import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tcgalglhxjznddqemteh.supabase.co'

const supabasePublishableKey =
  'sb_publishable_LC6cxXOXYWvxkoi5CdysQg_YvvnBiDt'

  export const supabase = createClient(
    supabaseUrl,
      supabasePublishableKey
      )