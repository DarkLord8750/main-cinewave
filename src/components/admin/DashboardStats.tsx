import { useEffect } from 'react';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { BarChart, Activity, Users, Film } from 'lucide-react';

const DashboardStats = () => {
  const { data, isLoading, error, fetchAnalytics } = useAnalyticsStore();

  useEffect(() => {
    fetchAnalytics();
    // Refresh analytics every 5 minutes
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-700">Error loading analytics: {error}</p>
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Users',
      value: data?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-500',
      trend: '+12%',
    },
    {
      title: 'Active Sessions',
      value: data?.activeSessions || 0,
      icon: Activity,
      color: 'text-green-500',
      trend: '+5%',
    },
    {
      title: 'Total Content',
      value: data?.totalContent || 0,
      icon: Film,
      color: 'text-purple-500',
      trend: '+8%',
    },
    {
      title: 'Views Today',
      value: data?.contentPopularity.reduce((acc, curr) => acc + curr.views, 0) || 0,
      icon: BarChart,
      color: 'text-orange-500',
      trend: '+15%',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.title} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className="text-2xl font-semibold mt-1">{stat.value.toLocaleString()}</p>
              </div>
              <div className={`${stat.color} bg-opacity-10 p-3 rounded-full`}>
                <stat.icon className={stat.color} size={24} />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-green-500 text-sm">{stat.trend}</span>
              <span className="text-gray-400 text-sm ml-2">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Popular Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Popular Content</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Title</th>
                <th className="text-right py-3 px-4">Views</th>
              </tr>
            </thead>
            <tbody>
              {data?.contentPopularity.map((content) => (
                <tr key={content.title} className="border-b last:border-0">
                  <td className="py-3 px-4">{content.title}</td>
                  <td className="text-right py-3 px-4">{content.views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {data?.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
              <div>
                <p className="font-medium">{activity.title}</p>
                <p className="text-sm text-gray-500">{activity.description}</p>
              </div>
              <p className="text-sm text-gray-400">
                {new Date(activity.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardStats; 