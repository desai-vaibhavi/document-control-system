import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DocumentItem } from '@/lib/constants';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const isAdmin = profile.role === 'admin';

    if (isAdmin) {
      // Admin Dashboard Metrics (Server-to-Server)
      const [
        { count: usersCount },
        { count: docsCount },
        { count: freeCount },
        { count: proCount },
        { data: feedData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('documents').select('*', { count: 'exact', head: true }),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'user')
          .eq('subscription_plan', 'free'),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'user')
          .eq('subscription_plan', 'pro'),
        supabase
          .from('documents')
          .select('*, profiles(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      return NextResponse.json({
        profile,
        isAdmin: true,
        adminStats: {
          totalUsers: usersCount || 0,
          totalDocs: docsCount || 0,
          freeUsers: freeCount || 0,
          proUsers: proCount || 0,
        },
        adminActivityFeed: (feedData as DocumentItem[]) || [],
      });
    } else {
      // User Dashboard Metrics (Server-to-Server)
      const [{ count: docsCount }, { data: docsData }] = await Promise.all([
        supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user.id),
        supabase
          .from('documents')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      return NextResponse.json({
        profile,
        isAdmin: false,
        userDocsCount: docsCount || 0,
        recentDocs: (docsData as DocumentItem[]) || [],
      });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
