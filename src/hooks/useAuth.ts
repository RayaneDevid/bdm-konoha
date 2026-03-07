import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { StaffUser } from '../types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchStaffUser(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchStaffUser(session.user.id);
      } else {
        setStaffUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchStaffUser(authUserId: string) {
    const { data } = await supabase
      .from('staff_users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    setStaffUser(data);
    setLoading(false);
  }

  return { session, staffUser, loading };
}
