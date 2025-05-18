import { useState } from 'react';
import { Upload, Download, Trash2 } from 'lucide-react';
import { useContentStore } from '../../stores/contentStore';
import { useToast } from '../ui/use-toast';

const BulkOperations = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { contents, fetchContents } = useContentStore();
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      setSelectedFile(file);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JSON file',
        variant: 'destructive'
      });
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const content = await selectedFile.text();
      const data = JSON.parse(content);

      // Validate the imported data structure
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format. Expected an array of content items.');
      }

      // Validate each content item
      data.forEach((item, index) => {
        const requiredFields = ['title', 'description', 'type', 'releaseYear', 'maturityRating'];
        requiredFields.forEach(field => {
          if (!item[field]) {
            throw new Error(`Missing required field "${field}" in item ${index + 1}`);
          }
        });
      });

      // Process the import in batches
      const batchSize = 10;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        await Promise.all(batch.map(item => {
          // Add content through the store
          return useContentStore.getState().addContent(item);
        }));
      }

      toast({
        title: 'Import successful',
        description: `Imported ${data.length} items successfully`,
        variant: 'success'
      });

      // Refresh the content list
      await fetchContents();
      setSelectedFile(null);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import content',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = () => {
    try {
      // Prepare the content data for export
      const exportData = contents.map(content => ({
        title: content.title,
        description: content.description,
        type: content.type,
        genre: content.genre,
        releaseYear: content.releaseYear,
        maturityRating: content.maturityRating,
        duration: content.duration,
        posterImage: content.posterImage,
        backdropImage: content.backdropImage,
        trailerUrl: content.trailerUrl,
        videoUrl480p: content.videoUrl480p,
        videoUrl720p: content.videoUrl720p,
        videoUrl1080p: content.videoUrl1080p,
        videoUrl4k: content.videoUrl4k,
        featured: content.featured,
        seasons: content.seasons
      }));

      // Create and download the JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `netflix-content-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Exported ${contents.length} items successfully`,
        variant: 'success'
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export content',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Bulk Operations</h3>
      
      <div className="space-y-4">
        {/* Import Section */}
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import Content
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-netflix-red file:text-white
                  hover:file:bg-netflix-red/90"
              />
              <button
                onClick={handleImport}
                disabled={!selectedFile || isUploading}
                className="inline-flex items-center px-4 py-2 bg-netflix-red text-white rounded-md hover:bg-netflix-red/90 disabled:opacity-50"
              >
                <Upload size={16} className="mr-2" />
                {isUploading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Content
          </label>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 bg-netflix-red text-white rounded-md hover:bg-netflix-red/90"
          >
            <Download size={16} className="mr-2" />
            Export All
          </button>
        </div>

        {/* Bulk Delete Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bulk Delete
          </label>
          <button
            onClick={() => {
              // Implement bulk delete functionality
              toast({
                title: 'Feature coming soon',
                description: 'Bulk delete functionality will be available soon',
                variant: 'default'
              });
            }}
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            <Trash2 size={16} className="mr-2" />
            Delete Selected
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkOperations; 