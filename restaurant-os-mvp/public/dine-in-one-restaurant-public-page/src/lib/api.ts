import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ApiResponse {
  user?: any;
  access?: string;
  session?: any;
  error?: { message: string };
}

// Maintain compatibility with existing code during transition
export const api = {
  async post(endpoint: string, data: any): Promise<ApiResponse> {
    if (endpoint === '/api/signup') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    name: data.name,
                    restaurant_name: data.restaurant_name,
                    role: 'restaurant_admin'
                }
            }
        });
        if (authError) throw authError;
        return { user: authData.user, session: authData.session };
    }
    
    if (endpoint === '/api/login') {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
        });
        if (authError) throw authError;

        // Fetch profile to check approval
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user?.id)
            .single();

        if (profileError) throw profileError;
        
        return {
            user: profile,
            access: authData.session?.access_token,
            session: authData.session
        };
    }
    return {};
  },

  async get(endpoint: string) {
    if (endpoint === '/api/user') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
            
        return profile;
    }
  },
};
