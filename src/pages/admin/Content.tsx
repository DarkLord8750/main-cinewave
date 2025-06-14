import { useState, useEffect } from 'react';
import {Film, Tv, Plus, Trash2 } from 'lucide-react';
import { Content, useContentStore } from '../../stores/contentStore';
import { useGenreStore } from '../../stores/genreStore';
import SeriesManager from '../../components/admin/SeriesManager';
import ContentTable from '../../components/admin/ContentTable';
import { SubtitleManager } from '../../components/admin/SubtitleManager';

interface CastMember {
  id: string;
  name: string;
  role: string;
  photoUrl: string;
}

// Define ratings for the dropdown
const ratings = ["G","A", "PG", "PG-13", "R", "NC-17", "TV-Y", "TV-G", "TV-PG", "TV-14", "TV-MA"];

// Flexible config for video qualities (only for movies)
const videoQualities = [
  { label: "480p", name: "videoUrl480p" as keyof Content },
  { label: "720p", name: "videoUrl720p" as keyof Content },
  { label: "1080p", name: "videoUrl1080p" as keyof Content },
  { label: "4K", name: "videoUrl4k" as keyof Content },
] as const;

// Helper for rendering input fields (for DRYness)
const renderInput = (
  field: {
    label: string;
    name: string;
    type: string;
    required?: boolean;
    options?: string[];
    placeholder?: string;
    min?: number;
    max?: number;
  },
  selectedContent: any,
  validationErrors: Record<string, string>
) => {
  const value = selectedContent?.[field.name];
  const error = validationErrors[field.name];
  const commonProps = {
    name: field.name,
    defaultValue: value,
    required: field.required,
    className: `w-full px-3 py-2 border rounded-md text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent ${error ? 'border-red-500' : 'border-gray-300'}`,
    ...(field.min !== undefined ? { min: field.min } : {}),
    ...(field.max !== undefined ? { max: field.max } : {}),
    ...(field.placeholder ? { placeholder: field.placeholder } : {}),
  };

  if (field.type === "textarea") {
    return (
      <div className="space-y-2" key={field.name}>
        <label className="block text-sm font-medium text-gray-700">{field.label}</label>
        <textarea {...commonProps} rows={3} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="space-y-2" key={field.name}>
        <label className="block text-sm font-medium text-gray-700">{field.label}</label>
        <select {...commonProps} defaultValue={value || field.options?.[0]}>
          {field.options?.map((opt: string) => (
            <option key={opt} value={opt} className="text-black">{opt}</option>
          ))}
        </select>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2" key={field.name}>
      <label className="block text-sm font-medium text-gray-700">{field.label}</label>
      <input type={field.type} {...commonProps} />
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};

const ContentManagement = () => {
  const { contents, addContent, updateContent, deleteContent, fetchContents, error: contentError } = useContentStore();
  const { genres, fetchGenres } = useGenreStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add-movie' | 'add-series' | 'edit' | 'view'>('add-movie');
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSeriesManager, setShowSeriesManager] = useState(false);
  const [cast, setCast] = useState<CastMember[]>([]);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchContents(),
          fetchGenres()
        ]);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [fetchContents, fetchGenres]);

  // Reset series manager visibility when modal mode changes
  useEffect(() => {
    setShowSeriesManager(modalMode === 'edit' && selectedContent?.type === 'series');
  }, [modalMode, selectedContent]);

  useEffect(() => {
    if (selectedContent) {
      setCast(selectedContent.cast || []);
    } else {
      setCast([]);
    }
  }, [selectedContent, isModalOpen]);

  const validateUrl = (url: string | null): boolean => {
    if (!url) return true; // Allow empty values
    try {
      const parsedUrl = new URL(url);
      // Check for valid protocol
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }
      // Check for valid hostname
      if (!parsedUrl.hostname || parsedUrl.hostname.length < 3) {
        return false;
      }
      // Check for common video/image file extensions for content URLs
      const validExtensions = ['.mp4', '.m3u8', '.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const hasValidExtension = validExtensions.some(ext => 
        parsedUrl.pathname.toLowerCase().endsWith(ext)
      );
      // Only check extensions for media URLs, not for trailer URLs (which might be YouTube/Vimeo)
      if (url.includes('videoUrl') || url.includes('Image') || url.includes('master_url')) {
        return hasValidExtension;
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleAddMovie = () => {
    setSelectedContent(null);
    setSelectedGenres([]);
    setModalMode('add-movie');
    setIsModalOpen(true);
    setValidationErrors({});
  };

  const handleAddSeries = () => {
    setSelectedContent(null);
    setSelectedGenres([]);
    setModalMode('add-series');
    setIsModalOpen(true);
    setValidationErrors({});
  };

  const handleEdit = (content: Content) => {
    setSelectedContent(content);
    setSelectedGenres(content.genre);
    setModalMode('edit');
    setIsModalOpen(true);
    setValidationErrors({});
  };

  const handleView = (id: string) => {
    const content = contents.find(c => c.id === id);
    if (content) {
      setSelectedContent(content);
      setSelectedGenres(content.genre);
      setModalMode('view');
      setIsModalOpen(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this content?')) {
      try {
        await deleteContent(id);
      } catch (error) {
        console.error('Failed to delete content:', error);
      }
    }
  };

  const handleAddCast = () => {
    setCast([...cast, { id: Date.now().toString(), name: '', role: '', photoUrl: '' }]);
  };

  const handleRemoveCast = (id: string) => {
    setCast(cast.filter(member => member.id !== id));
  };

  const handleCastChange = (id: string, field: keyof CastMember, value: string) => {
    setCast(cast.map(member => member.id === id ? { ...member, [field]: value } : member));
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    // Validate URLs and genres
    const errors: Record<string, string> = {};
    
    // Genre validation
    if (selectedGenres.length === 0) {
      errors.genres = 'Please select at least one genre';
    }

    // URL validation for required fields
    const requiredUrlFields = ['posterImage', 'backdropImage', 'trailerUrl'];
    requiredUrlFields.forEach(field => {
      const url = formData.get(field) as string;
      if (!url || !validateUrl(url)) {
        errors[field] = 'Please enter a valid URL starting with http:// or https://';
      }
    });

    // Video URL validation only for movies
    if (modalMode === 'add-movie' || (selectedContent && selectedContent.type === 'movie')) {
      videoQualities.forEach(({ name }) => {
        const url = formData.get(name) as string;
        if (url && !validateUrl(url)) {
          errors[name] = 'Please enter a valid URL starting with http:// or https://';
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Determine content type based on modal mode
    const type = modalMode === 'add-movie' ? 'movie' as const : 
                 modalMode === 'add-series' ? 'series' as const :
                 selectedContent?.type || 'movie' as const;

    const contentData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      type,
      releaseYear: parseInt(formData.get('releaseYear') as string),
      maturityRating: formData.get('maturityRating') as string,
      posterImage: formData.get('posterImage') as string,
      backdropImage: formData.get('backdropImage') as string,
      trailerUrl: formData.get('trailerUrl') as string,
      featured: formData.get('featured') === 'on',
      genre: selectedGenres,
      cast: cast.filter(member => member.name.trim() !== ''),
      // Only include video URLs for movies
      ...(type === 'movie' ? {
        master_url: formData.get('master_url') as string || undefined,
        master_url_480p: formData.get('master_url_480p') as string || undefined,
        master_url_720p: formData.get('master_url_720p') as string || undefined,
        master_url_1080p: formData.get('master_url_1080p') as string || undefined,
        videoUrl480p: formData.get('videoUrl480p') as string || undefined,
        videoUrl720p: formData.get('videoUrl720p') as string || undefined,
        videoUrl1080p: formData.get('videoUrl1080p') as string || undefined,
        videoUrl4k: formData.get('videoUrl4k') as string || undefined,
        subtitle_urls: JSON.parse(formData.get('subtitle_urls') as string || '{}')
      } : {}),
      // Include subtitle URLs for series as well
      ...(type === 'series' ? {
        subtitle_urls: JSON.parse(formData.get('subtitle_urls') as string || '{}')
      } : {})
    };

    try {
      setIsLoading(true);
      if (modalMode === 'add-movie' || modalMode === 'add-series') {
        const newContent = await addContent(contentData);
        if (modalMode === 'add-series' && newContent) {
          setSelectedContent(newContent);
          setShowSeriesManager(true);
          return; // Don't close the modal yet
        }
      } else if (selectedContent) {
        await updateContent(selectedContent.id, contentData);
      }
      
      // Close modal only if not adding a series or if updating
      setIsModalOpen(false);
      setSelectedContent(null);
      setSelectedGenres([]);
      setShowSeriesManager(false);
    } catch (error) {
      console.error('Failed to save content:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save content';
      setValidationErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeriesManagerClose = () => {
    setShowSeriesManager(false);
    setIsModalOpen(false);
    setSelectedContent(null);
    setSelectedGenres([]);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">Content Management</h1>
        <div className="flex space-x-4">
          <button
            onClick={handleAddMovie}
            className="flex items-center px-4 py-2 bg-[#E50914] text-white rounded-md hover:bg-[#E50914]/90"
            disabled={isLoading}
          >
            <Film className="mr-2" size={16} />
            Add Movie
          </button>
          <button
            onClick={handleAddSeries}
            className="flex items-center px-4 py-2 bg-[#E50914] text-white rounded-md hover:bg-[#E50914]/90"
            disabled={isLoading}
          >
            <Tv className="mr-2" size={16} />
            Add Series
          </button>
        </div>
      </div>

      {contentError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{contentError}</p>
        </div>
      )}

      <ContentTable
        contents={contents}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        isLoading={isLoading}
      />

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                {modalMode === 'add-movie' ? 'Add New Movie' :
                 modalMode === 'add-series' ? 'Add New Series' :
                 modalMode === 'edit' ? 'Edit Content' : 'View Content'}
              </h2>
            </div>

            {showSeriesManager && selectedContent ? (
              <div className="p-6">
                <SeriesManager
                  contentId={selectedContent.id}
                  seasons={selectedContent.seasons || []}
                  onSeasonsUpdated={async (updatedSeasons) => {
                    if (updatedSeasons) {
                      // Update local state immediately
                      setSelectedContent(prev => ({
                        ...prev!,
                        seasons: updatedSeasons
                      }));
                    }
                    // Then fetch from server to ensure consistency
                    await fetchContents();
                    const updated = contents.find(c => c.id === selectedContent.id);
                    if (updated) setSelectedContent(updated);
                  }}
                />
                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    onClick={handleSeriesManagerClose}
                    className="px-4 py-2 bg-[#E50914] text-white rounded-md hover:bg-[#E50914]/90"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="p-6 space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  {renderInput(
                    { label: "Title", name: "title", type: "text", required: true },
                    selectedContent,
                    validationErrors
                  )}
                  {renderInput(
                    { label: "Release Year", name: "releaseYear", type: "number", required: true, min: 1900, max: new Date().getFullYear() + 5 },
                    selectedContent,
                    validationErrors
                  )}
                </div>

                {renderInput(
                  { label: "Description", name: "description", type: "textarea", required: true },
                  selectedContent,
                  validationErrors
                )}

                <div className="grid grid-cols-2 gap-4">
                  {renderInput(
                    { label: "Maturity Rating", name: "maturityRating", type: "select", options: ratings, required: true },
                    selectedContent,
                    validationErrors
                  )}
                </div>

                {/* Media URLs */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Media</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {renderInput(
                      { label: "Poster Image URL", name: "posterImage", type: "url", required: true },
                      selectedContent,
                      validationErrors
                    )}
                    {renderInput(
                      { label: "Backdrop Image URL", name: "backdropImage", type: "url", required: true },
                      selectedContent,
                      validationErrors
                    )}
                  </div>
                  {renderInput(
                    { label: "Trailer URL", name: "trailerUrl", type: "url", required: true },
                    selectedContent,
                    validationErrors
                  )}
                </div>

                {/* Video Quality URLs */}
                  <div className="space-y-4">
                  <h5 className="font-medium">Video Quality URLs</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {videoQualities.map(quality => (
                      <div key={quality.name} className="space-y-2">
                        <label htmlFor={quality.name} className="block text-sm font-medium text-gray-700">{quality.label}</label>
                          <input
                          id={quality.name}
                          name={quality.name}
                            type="url"
                          placeholder={`https://example.com/video_${quality.name}.mp4`}
                          defaultValue={selectedContent?.[quality.name] as string | undefined}
                          disabled={isLoading}
                          className="w-full px-3 py-2 border rounded-md text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
                        />
                        {validationErrors[quality.name] && (
                          <p className="text-sm text-red-500">
                            {validationErrors[quality.name]}
                          </p>
                        )}
                        </div>
                      ))}
                    </div>
                  </div>

                {/* Subtitle URLs */}
                <div className="space-y-4">
                  <h5 className="font-medium">Subtitles</h5>
                  <SubtitleManager
                    value={selectedContent?.subtitle_urls || {}}
                    onChange={(value) => {
                      if (selectedContent) {
                        setSelectedContent({
                          ...selectedContent,
                          subtitle_urls: value
                        });
                      }
                      // Update the hidden input value
                      const form = document.querySelector('form');
                      const subtitleUrlsInput = form?.elements.namedItem('subtitle_urls') as HTMLTextAreaElement;
                      if (subtitleUrlsInput) {
                        subtitleUrlsInput.value = JSON.stringify(value);
                      }
                    }}
                    disabled={isLoading}
                  />
                  <textarea
                    id="subtitle_urls"
                    name="subtitle_urls"
                    className="hidden"
                    defaultValue={JSON.stringify(selectedContent?.subtitle_urls || {})}
                  />
                </div>

                {/* Master URL for Series/Movies */}
                {(modalMode === 'add-movie' || (selectedContent && selectedContent.type === 'movie')) && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-black">Master URLs</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Master URL", name: "master_url" as keyof Content },
                        { label: "Master URL 480p", name: "master_url_480p" as keyof Content },
                        { label: "Master URL 720p", name: "master_url_720p" as keyof Content },
                        { label: "Master URL 1080p", name: "master_url_1080p" as keyof Content },
                      ].map(q => (
                        <div className="space-y-2" key={q.name}>
                          <label className="block text-sm font-medium text-black">{q.label}</label>
                          <input
                            type="url"
                            name={q.name}
                            defaultValue={selectedContent?.[q.name] as string | undefined}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                          {validationErrors[q.name] && (
                            <p className="text-red-500 text-sm">{validationErrors[q.name]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Genres */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Genres</label>
                  <div className="grid grid-cols-3 gap-2 border border-gray-300 rounded-md p-4 max-h-48 overflow-y-auto">
                    {genres.map(genre => (
                      <div key={genre.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`genre-${genre.id}`}
                          checked={selectedGenres.includes(genre.name)}
                          onChange={() => {
                            if (selectedGenres.includes(genre.name)) {
                              setSelectedGenres(prev => prev.filter(g => g !== genre.name));
                            } else {
                              setSelectedGenres(prev => [...prev, genre.name]);
                            }
                          }}
                          className="h-4 w-4 text-[#E50914] focus:ring-[#E50914] border-gray-300 rounded"
                        />
                        <label htmlFor={`genre-${genre.id}`} className="ml-2 text-sm text-gray-700">
                          {genre.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  {validationErrors.genres && (
                    <p className="text-red-500 text-sm">{validationErrors.genres}</p>
                  )}
                </div>

                {/* Featured Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="featured"
                    name="featured"
                    defaultChecked={selectedContent?.featured}
                    className="h-4 w-4 text-[#E50914] focus:ring-[#E50914] border-gray-300 rounded"
                  />
                  <label htmlFor="featured" className="text-sm text-gray-700">
                    Featured content
                  </label>
                </div>

                {/* Cast Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Cast</h3>
                  <div className="space-y-4">
                    {cast.map((member, idx) => (
                      <div key={member.id} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-2 rounded">
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-gray-700">Name</label>
                          <input
                            type="text"
                            value={member.name}
                            onChange={e => handleCastChange(member.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-black"
                            placeholder="Actor Name"
                            required
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-gray-700">Role</label>
                          <input
                            type="text"
                            value={member.role}
                            onChange={e => handleCastChange(member.id, 'role', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-black"
                            placeholder="Character Name"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700">Photo URL</label>
                          <input
                            type="url"
                            value={member.photoUrl}
                            onChange={e => handleCastChange(member.id, 'photoUrl', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-black"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button type="button" onClick={() => handleRemoveCast(member.id)} className="text-red-500 hover:text-red-700 p-1">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={handleAddCast} className="flex items-center gap-2 px-3 py-1 bg-[#E50914] text-white rounded hover:bg-[#E50914]/80 mt-2">
                      <Plus size={16} /> Add Cast Member
                    </button>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedContent(null);
                      setSelectedGenres([]);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-[#E50914] text-white rounded-md hover:bg-[#E50914]/90 disabled:opacity-50"
                  >
                    {isLoading ? 'Saving...' : modalMode.startsWith('add') ? 'Add Content' : 'Save Changes'}
                  </button>
                </div>

                {validationErrors.submit && (
                  <p className="text-red-500 text-sm mt-2">{validationErrors.submit}</p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentManagement;
