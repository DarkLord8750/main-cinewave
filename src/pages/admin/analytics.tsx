import { useEffect, useState } from 'react';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { TrendingUp, Users, Film, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns';

const UserAnalytics = () => {
  const { data, isLoading, error, fetchAnalytics } = useAnalyticsStore();
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [fetchAnalytics, timeRange]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">Error loading analytics: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      title: 'Total Users',
      value: data.totalUsers,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      trend: '+12%',
      trendUp: true,
    },
    {
      title: 'Active Sessions',
      value: data.activeSessions,
      icon: Activity,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      trend: '+5%',
      trendUp: true,
    },
    {
      title: 'Total Content',
      value: data.totalContent,
      icon: Film,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      trend: '+8%',
      trendUp: true,
    },
    {
      title: 'Views Today',
      value: data.contentPopularity.reduce((acc, curr) => acc + curr.views, 0),
      icon: TrendingUp,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      trend: '+15%',
      trendUp: true,
    },
  ];

  const formatDate = (date: string) => {
    return format(parseISO(date), 'MMM dd');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="text-sm font-medium text-black">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm text-black">
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-black">Analytics Dashboard</h1>
            <p className="text-sm text-black">Monitor your platform's performance and user engagement</p>
          </div>
          <div className="flex space-x-2">
            {['7d', '30d', '90d', '1y'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  timeRange === range
                    ? 'bg-[#E50914] text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.title} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black">{stat.title}</p>
                  <p className="text-2xl font-semibold mt-1 text-black">{stat.value.toLocaleString()}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-full`}>
                  <stat.icon className={stat.color} size={24} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                {stat.trendUp ? (
                  <ArrowUp className="text-green-500 h-4 w-4" />
                ) : (
                  <ArrowDown className="text-red-500 h-4 w-4" />
                )}
                <span className={`text-sm ml-1 ${stat.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                  {stat.trend}
                </span>
                <span className="text-black text-sm ml-2">vs last period</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-black">User Growth</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.timeRangeData.userGrowth}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12, fill: '#000000' }}
                    tickLine={false}
                    axisLine={{ stroke: '#000000' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#000000' }}
                    tickLine={false}
                    axisLine={{ stroke: '#000000' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Users"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Content Views Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-black">Content Views</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.timeRangeData.contentViews}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12, fill: '#000000' }}
                    tickLine={false}
                    axisLine={{ stroke: '#000000' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#000000' }}
                    tickLine={false}
                    axisLine={{ stroke: '#000000' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="views" name="Views" fill="#E50914" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Activity and Popular Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-black">Recent Activity</h3>
            <div className="space-y-4">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                  <div>
                    <p className="font-medium text-black">{activity.title}</p>
                    <p className="text-sm text-black">{activity.description}</p>
                  </div>
                  <p className="text-sm text-black">
                    {format(parseISO(activity.timestamp), 'MMM dd, HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Content */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-black">Popular Content</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-black">Title</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-black">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contentPopularity.map((content) => (
                    <tr key={content.title} className="border-b last:border-0">
                      <td className="py-3 px-4 text-black">{content.title}</td>
                      <td className="text-right py-3 px-4 text-black">{content.views.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAnalytics; 
