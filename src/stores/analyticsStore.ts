import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Analytics {
  totalUsers: number;
  totalContent: number;
  activeSessions: number;
  userGrowth: {
    date: string;
    count: number;
  }[];
  contentPopularity: {
    title: string;
    views: number;
  }[];
  recentActivity: {
    id: string;
    type: 'user' | 'content' | 'watch';
    title: string;
    description: string;
    timestamp: string;
  }[];
}

interface AnalyticsState {
  data: Analytics | null;
  isLoading: boolean;
  error: string | null;
  fetchAnalytics: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchAnalytics: async () => {
    set({ isLoading: true, error: null });
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get total content
      const { count: totalContent } = await supabase
        .from('content')
        .select('*', { count: 'exact', head: true });

      // Get active sessions (users with watch history in last hour)
      const { count: activeSessions } = await supabase
        .from('watch_history')
        .select('*', { count: 'exact', head: true })
        .gt('last_watched', new Date(Date.now() - 3600000).toISOString());

      // Get user growth over time
      const { data: userGrowth } = await supabase
        .from('users')
        .select('created_at')
        .order('created_at', { ascending: true });

      // Get content popularity
      const { data: watchHistory } = await supabase
        .from('watch_history')
        .select(`
          content_id,
          content (title)
        `)
        .order('last_watched', { ascending: false })
        .limit(10);

      // Get recent activity
      const { data: recentActivity } = await supabase
        .from('watch_history')
        .select(`
          id,
          last_watched,
          profiles (name),
          content (title)
        `)
        .order('last_watched', { ascending: false })
        .limit(10);

      // Process user growth data
      const userGrowthByDate = userGrowth?.reduce((acc: { [key: string]: number }, user) => {
        const date = new Date(user.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {}) || {};

      const userGrowthData = Object.entries(userGrowthByDate).map(([date, count]) => ({
        date,
        count
      }));

      // Process content popularity data
      const contentViews = watchHistory?.reduce((acc: { [key: string]: number }, watch) => {
        const title = watch.content?.title || 'Unknown';
        acc[title] = (acc[title] || 0) + 1;
        return acc;
      }, {}) || {};

      const contentPopularityData = Object.entries(contentViews)
        .map(([title, views]) => ({ title, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Process recent activity
      const recentActivityData = recentActivity?.map(activity => ({
        id: activity.id,
        type: 'watch' as const,
        title: activity.content?.title || 'Unknown Content',
        description: `Watched by ${activity.profiles?.name || 'Unknown User'}`,
        timestamp: activity.last_watched
      })) || [];

      set({
        data: {
          totalUsers: totalUsers || 0,
          totalContent: totalContent || 0,
          activeSessions: activeSessions || 0,
          userGrowth: userGrowthData,
          contentPopularity: contentPopularityData,
          recentActivity: recentActivityData
        },
        isLoading: false
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
        isLoading: false 
      });
    }
  }
}));