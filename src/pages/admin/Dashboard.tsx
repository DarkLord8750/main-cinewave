import { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import DashboardStats from '../../components/admin/DashboardStats';
import BulkOperations from '../../components/admin/BulkOperations';

const AdminDashboard = () => {
  const [activeTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6 text-black">
            <DashboardStats />
            <BulkOperations />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-4">
              <button
              className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-[#E50914] text-white`}
              disabled
              >
              <BarChart2 className="h-5 w-5 mr-2" />
              Overview
              </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow text-black">
          {renderContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-black">
            © {new Date().getFullYear()} CineWave Admin Panel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AdminDashboard;
