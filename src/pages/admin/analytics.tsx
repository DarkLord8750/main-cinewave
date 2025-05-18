import { useEffect } from 'react';
import { useAnalyticsStore } from '../../stores/analyticsStore';

const UserAnalytics = () => {
  const { data, isLoading, error, fetchAnalytics } = useAnalyticsStore();

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }
  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>;
  }
  if (!data) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6 text-black">User Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <div className="text-3xl font-bold text-red-600">{data.totalUsers}</div>
          <div className="text-gray-700 mt-2">Total Users</div>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <div className="text-3xl font-bold text-green-600">{data.activeSessions}</div>
          <div className="text-gray-700 mt-2">Active Sessions (last hour)</div>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <div className="text-3xl font-bold text-blue-600">{data.userGrowth?.slice(-1)[0]?.count || 0}</div>
          <div className="text-gray-700 mt-2">New Users (latest day)</div>
        </div>
      </div>
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-black">User Growth Over Time</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Users</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.userGrowth.map((row) => (
                <tr key={row.date}>
                  <td className="px-4 py-2">{row.date}</td>
                  <td className="px-4 py-2">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserAnalytics; 