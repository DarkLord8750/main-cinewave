import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { subDays, subMonths, subYears, format, parseISO } from 'date-fns';

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
  timeRangeData: {
    userGrowth: { date: string; count: number }[];
    contentViews: { date: string; views: number }[];
    activeUsers: { date: string; count: number }[];
  };
}

interface AnalyticsState {
  data: Analytics | null;
  isLoading: boolean;
  error: string | null;
  fetchAnalytics: (timeRange?: string) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchAnalytics: async (timeRange = '7d') => {
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

      // Calculate date range based on timeRange
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case '30d':
          startDate = subDays(now, 30);
          break;
        case '90d':
          startDate = subMonths(now, 3);
          break;
        case '1y':
          startDate = subYears(now, 1);
          break;
        default:
          startDate = subDays(now, 7);
      }

      // Get user growth data
      const { data: userGrowth } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      // Get content views data
      const { data: watchHistory } = await supabase
        .from('watch_history')
        .select(`
          content_id,
          last_watched,
          content (title)
        `)
        .gte('last_watched', startDate.toISOString())
        .order('last_watched', { ascending: true });

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
        const date = format(parseISO(user.created_at), 'yyyy-MM-dd');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {}) || {};

      // Process content views data
      const contentViewsByDate = watchHistory?.reduce((acc: { [key: string]: number }, watch) => {
        const date = format(parseISO(watch.last_watched), 'yyyy-MM-dd');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {}) || {};

      // Process active users data
      const activeUsersByDate = watchHistory?.reduce((acc: { [key: string]: Set<string> }, watch) => {
        const date = format(parseISO(watch.last_watched), 'yyyy-MM-dd');
        if (!acc[date]) {
          acc[date] = new Set();
        }
        acc[date].add(watch.content_id);
        return acc;
      }, {}) || {};

      // Convert to arrays and fill missing dates
      const allDates = new Set([
        ...Object.keys(userGrowthByDate),
        ...Object.keys(contentViewsByDate),
        ...Object.keys(activeUsersByDate),
      ]);

      const timeRangeData = {
        userGrowth: Array.from(allDates).map(date => ({
          date,
          count: userGrowthByDate[date] || 0,
        })),
        contentViews: Array.from(allDates).map(date => ({
          date,
          views: contentViewsByDate[date] || 0,
        })),
        activeUsers: Array.from(allDates).map(date => ({
          date,
          count: activeUsersByDate[date]?.size || 0,
        })),
      };

      // Process content popularity
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
        timestamp: activity.last_watched,
      })) || [];

      set({
        data: {
          totalUsers: totalUsers || 0,
          totalContent: totalContent || 0,
          activeSessions: activeSessions || 0,
          userGrowth: Object.entries(userGrowthByDate).map(([date, count]) => ({
            date,
            count,
          })),
          contentPopularity: contentPopularityData,
          recentActivity: recentActivityData,
          timeRangeData,
        },
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
        isLoading: false,
      });
    }
  },
}));
