import { useState, useEffect } from 'react';
import {Film, Tv, Plus, Trash2 } from 'lucide-react';
import { Content, useContentStore } from '../../stores/contentStore';
import { useGenreStore } from '../../stores/genreStore';
import SeriesManager from '../../components/admin/SeriesManager';
import ContentTable from '../../components/admin/ContentTable';
import { SubtitleManager } from '../../components/admin/SubtitleManager';
import { Button } from '../../components/ui/button';
import { createClient } from '@supabase/supabase-js';

interface CastMember {
  id: string;
  name: string;
  role: string;
  photoUrl: string;
}

// Define ratings for the dropdown
const ratings = [
  // 🇮🇳 Indian CBFC Official
  "U",          // Universal (all ages)
  "UA",         // Parental guidance for children under 12
  "A",          // Adults only (18+)
  "S",          // Restricted to specialized audiences

  // 🇮🇳 Indian OTT Platforms (non-CBFC, self-regulated)
  "U/A 7+",     // Suitable for 7+ with parental guidance
  "U/A 13+",    // Suitable for 13+ with parental guidance
  "U/A 16+",    // Suitable for 16+ with parental guidance
  "18+",        // Adults only

  // 🇺🇸 US Motion Picture Association (MPA)
  "G",          // General Audiences
  "PG",         // Parental Guidance Suggested
  "PG-13",      // Parents Strongly Cautioned (under 13)
  "R",          // Restricted (under 17 with adult)
  "NC-17",      // Adults Only (no one under 17)

  // 🇺🇸 US TV Parental Guidelines
  "TV-Y",       // All Children
  "TV-Y7",      // Older Children (7+)
  "TV-G",       // General Audience
  "TV-PG",      // Parental Guidance Suggested
  "TV-14",      // Parents Strongly Cautioned (14+)
  "TV-MA",      // Mature Audience Only (17+)

  // 🇬🇧 UK British Board of Film Classification (BBFC)
  "U (UK)",     // Universal
  "PG (UK)",    // Parental Guidance
  "12A",        // 12+ with adult
  "15",         // 15 and above
  "18",         // Adults only
  "R18",        // Explicit adult content

  // 🌍 Other / General
  "NR",         // Not Rated
  "Unrated",    // Not submitted for classification
  "Pending",    // Rating not yet assigned
];



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

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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
  const [castMembers, setCastMembers] = useState<CastMember[]>([]);
  const [subtitleUrls, setSubtitleUrls] = useState<{ [key: string]: string }>({});
  const [allCastMembers, setAllCastMembers] = useState<CastMember[]>([]);
  const [selectedCastIds, setSelectedCastIds] = useState<string[]>([]);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchContents(),
          fetchGenres()
        ]);
        // Fetch all cast members from Supabase
        const { data, error } = await supabase.from('cast_members').select('*');
        if (!error && data) {
          setAllCastMembers(data.map((c: any) => ({
            id: c.id,
            name: c.name,
            role: '',
            photoUrl: c.photo_url || ''
          })));
        }
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
      setCastMembers(selectedContent.cast || []);
      setSelectedCastIds([]);
    } else {
      setCastMembers([]);
      setSelectedCastIds([]);
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
    setSubtitleUrls({});
  };

  const handleAddSeries = () => {
    setSelectedContent(null);
    setSelectedGenres([]);
    setModalMode('add-series');
    setIsModalOpen(true);
    setValidationErrors({});
    setSubtitleUrls({});
  };

  const handleEdit = (content: Content) => {
    setSelectedContent(content);
    setSelectedGenres(content.genre);
    setModalMode('edit');
    setIsModalOpen(true);
    setValidationErrors({});
    setSubtitleUrls(content.subtitle_urls || {});
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
    setCastMembers([...castMembers, { id: Date.now().toString(), name: '', role: '', photoUrl: '' }]);
  };

  const handleRemoveCast = (id: string) => {
    setCastMembers(castMembers.filter(member => member.id !== id));
  };

  const handleCastChange = (id: string, field: keyof CastMember, value: string) => {
    setCastMembers(castMembers.map(member => member.id === id ? { ...member, [field]: value } : member));
  };

  const handleSelectCast = (id: string) => {
    if (!selectedCastIds.includes(id)) {
      setSelectedCastIds([...selectedCastIds, id]);
      const member = allCastMembers.find(c => c.id === id);
      if (member && !castMembers.some(m => m.id === id)) {
        setCastMembers([...castMembers, member]);
      }
    }
  };

  const handleRemoveSelectedCast = (id: string) => {
    setSelectedCastIds(selectedCastIds.filter(cid => cid !== id));
    setCastMembers(castMembers.filter(m => m.id !== id));
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

    // Parse subtitle URLs from the form
    let subtitleUrls = {};
    try {
      const subtitleUrlsStr = formData.get('subtitle_urls') as string;
      if (subtitleUrlsStr) {
        subtitleUrls = JSON.parse(subtitleUrlsStr);
      }
    } catch (error) {
      console.error('Error parsing subtitle URLs:', error);
      subtitleUrls = {};
    }

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
      duration: (modalMode === 'add-movie' || (selectedContent && selectedContent.type === 'movie')) ? formData.get('duration') as string : undefined,
      cast: [
        // Pre-selected from dropdown
        ...allCastMembers.filter(m => selectedCastIds.includes(m.id)),
        // Custom added
        ...castMembers.filter(m => !allCastMembers.some(am => am.id === m.id) && m.name.trim() !== ''),
      ],
      subtitle_urls: subtitleUrls,
      // Only include video URLs for movies
      ...(type === 'movie' ? {
        master_url: formData.get('master_url') as string || undefined,
        master_url_480p: formData.get('master_url_480p') as string || undefined,
        master_url_720p: formData.get('master_url_720p') as string || undefined,
        master_url_1080p: formData.get('master_url_1080p') as string || undefined,
        videoUrl480p: formData.get('videoUrl480p') as string || undefined,
        videoUrl720p: formData.get('videoUrl720p') as string || undefined,
        videoUrl1080p: formData.get('videoUrl1080p') as string || undefined,
        videoUrl4k: formData.get('videoUrl4k') as string || undefined
      } : {})
    };

    try {
      setIsLoading(true);
      if (selectedContent) {
        // Update existing content (both for view and edit modes)
        await updateContent(selectedContent.id, contentData);
      } else if (modalMode.startsWith('add')) {
        // Add new content
        await addContent(contentData);
      }
      setIsModalOpen(false);
      setSelectedContent(null);
      setSelectedGenres([]);
      setValidationErrors({});
    } catch (error) {
      console.error('Error saving content:', error);
      setValidationErrors({
        submit: error instanceof Error ? error.message : 'Failed to save content'
      });
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
              <form onSubmit={handleSave} className="p-6 space-y-8">
                {/* Basic Information Section */}
                <div className="bg-gray-50 p-6 rounded-lg space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-3">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-6">
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
                    {/* Duration input for movies only */}
                    {(modalMode === 'add-movie' || (selectedContent && selectedContent.type === 'movie')) && (
                      renderInput(
                        { label: "Duration (e.g. 98m)", name: "duration", type: "text", required: true, placeholder: "e.g. 98m" },
                        selectedContent,
                        validationErrors
                      )
                    )}
                  </div>

                  {renderInput(
                    { label: "Description", name: "description", type: "textarea", required: true },
                    selectedContent,
                    validationErrors
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    {renderInput(
                      { label: "Maturity Rating", name: "maturityRating", type: "select", options: ratings, required: true },
                      selectedContent,
                      validationErrors
                    )}
                  </div>
                </div>

                {/* Media Section */}
                <div className="bg-gray-50 p-6 rounded-lg space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-3">Media</h3>
                  <div className="grid grid-cols-2 gap-6">
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

                {/* Video Quality URLs Section */}
                <div className="bg-gray-50 p-6 rounded-lg space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-3">Video Quality URLs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
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

                {/* Master URLs Section */}
                {(modalMode === 'add-movie' || (selectedContent && selectedContent.type === 'movie')) && (
                  <div className="bg-gray-50 p-6 rounded-lg space-y-6">
                    <h3 className="text-xl font-semibold text-gray-900 border-b pb-3">Master URLs</h3>
                    <div className="grid grid-cols-2 gap-6">
                      {[
                        { label: "Master URL", name: "master_url" as keyof Content },
                        { label: "Master URL 480p", name: "master_url_480p" as keyof Content },
                        { label: "Master URL 720p", name: "master_url_720p" as keyof Content },
                        { label: "Master URL 1080p", name: "master_url_1080p" as keyof Content },
                      ].map(q => (
                        <div className="space-y-2" key={q.name}>
                          <label className="block text-sm font-medium text-gray-700">{q.label}</label>
                          <input
                            type="url"
                            name={q.name}
                            defaultValue={selectedContent?.[q.name] as string | undefined}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
                          />
                          {validationErrors[q.name] && (
                            <p className="text-red-500 text-sm">{validationErrors[q.name]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subtitles Section */}
                <div className="bg-gradient-to-b from-gray-50/90 to-gray-50/70 rounded-xl p-6 space-y-6 border border-gray-200/80 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h5 className="text-lg font-medium bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Subtitles</h5>
                      <p className="text-sm text-gray-500 mt-1">Add subtitles in different languages</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      onClick={() => {
                        setSubtitleUrls({});
                        const form = document.querySelector('form');
                        const subtitleUrlsInput = form?.elements.namedItem('subtitle_urls') as HTMLTextAreaElement;
                        if (subtitleUrlsInput) {
                          subtitleUrlsInput.value = JSON.stringify({}, null, 2);
                        }
                      }}
                      className="text-sm bg-white/80 backdrop-blur-sm border-gray-200 text-red hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm hover:shadow"
                    >
                      <Trash2 size={14} className="text-black group-hover:text-red-500" />
                      Clear All
                    </Button>
                  </div>
                  <div className="space-y-4">
                  <SubtitleManager
                      value={modalMode === 'edit' ? selectedContent?.subtitle_urls || {} : subtitleUrls}
                    onChange={(value) => {
                        if (modalMode === 'edit' && selectedContent) {
                        setSelectedContent({
                          ...selectedContent,
                          subtitle_urls: value
                        });
                        } else {
                          setSubtitleUrls(value);
                      }
                      const form = document.querySelector('form');
                      const subtitleUrlsInput = form?.elements.namedItem('subtitle_urls') as HTMLTextAreaElement;
                      if (subtitleUrlsInput) {
                          subtitleUrlsInput.value = JSON.stringify(value, null, 2);
                      }
                    }}
                    disabled={isLoading}
                  />
                  <textarea
                    id="subtitle_urls"
                    name="subtitle_urls"
                    className="hidden"
                      defaultValue={JSON.stringify(modalMode === 'edit' ? selectedContent?.subtitle_urls || {} : subtitleUrls, null, 2)}
                  />
                  </div>
                </div>

                {/* Genres Section */}
                <div className="bg-gray-50 p-6 rounded-lg space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-3">Genres</h3>
                  <div className="grid grid-cols-3 gap-4 border border-gray-300 rounded-lg p-6 max-h-48 overflow-y-auto">
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
                <div className="bg-gray-50 p-6 rounded-lg space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-3">Featured Status</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="featured"
                      name="featured"
                      defaultChecked={selectedContent?.featured}
                      className="h-5 w-5 text-[#E50914] focus:ring-[#E50914] border-gray-300 rounded"
                    />
                    <label htmlFor="featured" className="text-sm font-medium text-gray-700">
                      Featured content
                    </label>
                  </div>
                </div>

                {/* Cast Section */}
                <div className="bg-gray-50 p-6 rounded-lg space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-3">Cast</h3>
                  {/* Dropdown for pre-added cast members */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select from existing cast members</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
                      onChange={e => handleSelectCast(e.target.value)}
                      value=""
                      disabled={isLoading}
                    >
                      <option value="">-- Select Cast Member --</option>
                      {allCastMembers.filter(m => !selectedCastIds.includes(m.id)).map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-4">
                    {/* Show selected (pre-added) cast members */}
                    {castMembers.filter(m => selectedCastIds.includes(m.id)).map(member => (
                      <div key={member.id} className="grid grid-cols-12 gap-4 items-end bg-white p-4 rounded-lg shadow-sm">
                        <div className="col-span-4 flex items-center gap-2">
                          {member.photoUrl && <img src={member.photoUrl} alt={member.name} className="w-8 h-8 rounded-full object-cover" />}
                          <span className="font-medium text-black">{member.name}</span>
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={member.role}
                            onChange={e => handleCastChange(member.id, 'role', e.target.value)}
                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
                            placeholder="Character Name"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="url"
                            value={member.photoUrl}
                            onChange={e => handleCastChange(member.id, 'photoUrl', e.target.value)}
                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSelectedCast(member.id)} 
                            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Custom (inline) cast members */}
                    {castMembers.filter(m => !selectedCastIds.includes(m.id)).map((member) => (
                      <div key={member.id} className="grid grid-cols-12 gap-4 items-end bg-white p-4 rounded-lg shadow-sm">
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={member.name}
                            onChange={e => handleCastChange(member.id, 'name', e.target.value)}
                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
                            placeholder="Actor Name"
                            required
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={member.role}
                            onChange={e => handleCastChange(member.id, 'role', e.target.value)}
                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
                            placeholder="Character Name"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="url"
                            value={member.photoUrl}
                            onChange={e => handleCastChange(member.id, 'photoUrl', e.target.value)}
                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveCast(member.id)} 
                            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button 
                      type="button" 
                      onClick={handleAddCast} 
                      className="flex items-center gap-2 px-4 py-2 bg-[#E50914] text-white rounded-lg hover:bg-[#E50914]/90 transition-colors"
                    >
                      <Plus size={16} /> Add Cast Member
                    </button>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedContent(null);
                      setSelectedGenres([]);
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2 bg-[#E50914] text-white rounded-lg hover:bg-[#E50914]/90 disabled:opacity-50 transition-colors"
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
