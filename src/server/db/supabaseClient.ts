import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
    throw new Error(
        'Missing required environment variable: SUPABASE_URL. ' +
            'Set it before starting the server.',
    )
}

if (!supabaseServiceRoleKey) {
    throw new Error(
        'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. ' +
            'Set it before starting the server.',
    )
}

const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey)

export default supabaseClient
