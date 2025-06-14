import { useState, useEffect } from 'react';
import { Plus, Edit, Trash, ChevronDown, ChevronUp, Loader2, Trash2, X } from 'lucide-react';
import { useContentStore, Season, Episode } from '../../stores/contentStore';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useToast } from '../ui/use-toast';
import { SubtitleManager } from './SubtitleManager';

interface SeriesManagerProps {
  contentId: string;
  seasons: Season[];
  onSeasonsUpdated?: (updatedSeasons?: Season[]) => void;
}

type VideoQuality = 'master_url' | 'master_url_480p' | 'master_url_720p' | 'master_url_1080p' | '480p' | '720p' | '1080p' | '4k';

const videoQualities: VideoQuality[] = ['master_url', 'master_url_480p', 'master_url_720p', 'master_url_1080p', '480p', '720p', '1080p', '4k'];

const SeriesManager = ({ contentId, seasons, onSeasonsUpdated }: SeriesManagerProps) => {
  const { toast } = useToast();
  const [expandedSeasons, setExpandedSeasons] = useState<string[]>([]);
  const [isAddingEpisode, setIsAddingEpisode] = useState(false);
  const [isAddingSeason, setIsAddingSeason] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { addSeason, updateSeason, deleteSeason, addEpisode, updateEpisode, deleteEpisode } = useContentStore();

  // --- Inline editing state ---
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editSeasonNumber, setEditSeasonNumber] = useState<number | null>(null);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [editEpisodeData, setEditEpisodeData] = useState<Partial<Episode> | null>(null);

  // Reset states when contentId changes
  useEffect(() => {
    setExpandedSeasons([]);
    setIsAddingEpisode(false);
    setIsAddingSeason(false);
    setSelectedSeason(null);
  }, [contentId]);

  useEffect(() => {
    // Fetch latest seasons after add/update/delete
    if (typeof onSeasonsUpdated === 'function') {
      onSeasonsUpdated();
    }
    // eslint-disable-next-line
  }, [contentId]);

  const validateForm = (formData: Record<string, any>): boolean => {
    const errors: Record<string, string> = {};
    
    // Common validation rules
    if (!formData.title?.trim()) {
      errors.title = 'Title is required';
    }

    // Season specific validations
    if ('seasonNumber' in formData) {
      const seasonNum = parseInt(formData.seasonNumber);
      if (isNaN(seasonNum)) {
        errors.seasonNumber = 'Invalid season number';
      } else if (seasonNum <= 0) {
        errors.seasonNumber = 'Season number must be positive';
      } else if (seasons.some(s => s.seasonNumber === seasonNum && s.id !== selectedSeason?.id)) {
        errors.seasonNumber = 'Season number already exists';
      }
    }

    // Episode specific validations
    if ('episodeNumber' in formData) {
      const episodeNum = typeof formData.episodeNumber === 'string' 
        ? parseInt(formData.episodeNumber) 
        : formData.episodeNumber;
      
      if (isNaN(episodeNum)) {
        errors.episodeNumber = 'Invalid episode number';
      } else if (episodeNum <= 0) {
        errors.episodeNumber = 'Episode number must be positive';
      } else if (selectedSeason?.episodes?.some(e => e.episodeNumber === episodeNum && e.id !== editingEpisodeId)) {
        errors.episodeNumber = 'Episode number already exists in this season';
      }
    }

    // Duration validation
    if ('duration' in formData && !/^\d+m$/.test(formData.duration)) {
      errors.duration = 'Duration must be in format like "45m"';
    }

    // URL validation
    const validateUrl = (url: string, fieldName: string) => {
      if (!url) return;
      try {
        new URL(url);
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          errors[fieldName] = 'URL must start with http:// or https://';
        }
      } catch {
        errors[fieldName] = 'Invalid URL format';
      }
    };

    videoQualities.forEach(quality => {
      if (`videoUrl${quality}` in formData) validateUrl(formData[`videoUrl${quality}`], `videoUrl${quality}`);
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const toggleSeason = (seasonId: string) => {
    setExpandedSeasons(prev => 
      prev.includes(seasonId) 
        ? prev.filter(id => id !== seasonId)
        : [...prev, seasonId]
    );
  };

  const handleAddSeason = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = {
      seasonNumber: (form.elements.namedItem('seasonNumber') as HTMLInputElement).value,
      title: (form.elements.namedItem('title') as HTMLInputElement)?.value || '',
      description: (form.elements.namedItem('description') as HTMLTextAreaElement)?.value || ''
    };

    try {
      setIsLoading(true);
      setValidationErrors({});

      const seasonData = {
        seasonNumber: parseInt(formData.seasonNumber),
        seriesId: contentId,
        title: formData.title.trim() || `Season ${formData.seasonNumber}`,
        description: formData.description.trim() || null
      };

      // Validate season number is unique
      if (seasons.some(s => s.seasonNumber === seasonData.seasonNumber)) {
        setValidationErrors(prev => ({
          ...prev,
          seasonNumber: 'Season number already exists'
        }));
        return;
      }

      const newSeason = await addSeason(contentId, seasonData);
      // Update local state immediately
      const updatedSeasons = [...seasons, newSeason];
      onSeasonsUpdated?.(updatedSeasons);
      toast({
        title: 'Season added successfully',
        variant: 'success'
      });
      setIsAddingSeason(false);
    } catch (error) {
      console.error('Error adding season:', error);
      toast({
        title: 'Failed to add season',
        description: error instanceof Error 
          ? error.message 
          : typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
            : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEpisode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSeason) return;
    
    const form = e.currentTarget as HTMLFormElement;
    const formData = {
      episodeNumber: Number((form.elements.namedItem('episodeNumber') as HTMLInputElement)?.value || '0'),
      title: (form.elements.namedItem('title') as HTMLInputElement)?.value || '',
      duration: (form.elements.namedItem('duration') as HTMLInputElement)?.value || '',
      master_url: (form.elements.namedItem('master_url') as HTMLInputElement)?.value || undefined,
      master_url_480p: (form.elements.namedItem('master_url_480p') as HTMLInputElement)?.value || undefined,
      master_url_720p: (form.elements.namedItem('master_url_720p') as HTMLInputElement)?.value || undefined,
      master_url_1080p: (form.elements.namedItem('master_url_1080p') as HTMLInputElement)?.value || undefined,
      videoUrl480p: (form.elements.namedItem('videoUrl480p') as HTMLInputElement)?.value || undefined,
      videoUrl720p: (form.elements.namedItem('videoUrl720p') as HTMLInputElement)?.value || undefined,
      videoUrl1080p: (form.elements.namedItem('videoUrl1080p') as HTMLInputElement)?.value || undefined,
      videoUrl4k: (form.elements.namedItem('videoUrl4k') as HTMLInputElement)?.value || undefined,
      subtitle_urls: JSON.parse((form.elements.namedItem('subtitle_urls') as HTMLTextAreaElement)?.value || '{}')
    };
    
    // Validate required fields
    if (!formData.title || !formData.title.trim()) {
      setValidationErrors(prev => ({ ...prev, title: 'Title is required' }));
      return;
    }

    // Validate duration format
    if (!formData.duration.endsWith('m')) {
      setValidationErrors(prev => ({ ...prev, duration: 'Duration must be in format like "45m"' }));
      return;
    }

    // Validate at least one video URL
    const hasVideoUrl = formData.master_url || formData.master_url_480p || formData.master_url_720p || 
                       formData.master_url_1080p || formData.videoUrl480p || formData.videoUrl720p || 
                       formData.videoUrl1080p || formData.videoUrl4k;
    
    if (!hasVideoUrl) {
      setValidationErrors(prev => ({ ...prev, videoUrl: 'At least one video URL is required' }));
      return;
    }

    try {
      setIsLoading(true);
      const newEpisode = await addEpisode(selectedSeason.id, {
        seasonId: selectedSeason.id,
        episodeNumber: formData.episodeNumber,
        title: formData.title.trim(),
        duration: formData.duration,
        master_url: formData.master_url,
        master_url_480p: formData.master_url_480p,
        master_url_720p: formData.master_url_720p,
        master_url_1080p: formData.master_url_1080p,
        videoUrl480p: formData.videoUrl480p,
        videoUrl720p: formData.videoUrl720p,
        videoUrl1080p: formData.videoUrl1080p,
        videoUrl4k: formData.videoUrl4k,
        subtitle_urls: formData.subtitle_urls
      });

      // Update local state immediately
      const updatedSeasons = seasons.map(season => 
        season.id === selectedSeason.id
          ? { ...season, episodes: [...(season.episodes ?? []), newEpisode] }
          : season
      );
      onSeasonsUpdated?.(updatedSeasons);
      toast({
        title: 'Episode added successfully',
        variant: 'success'
      });
      setIsAddingEpisode(false);
      setSelectedSeason(null);
    } catch (error) {
      toast({
        title: 'Failed to add episode',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Inline season edit handlers ---
  const startEditSeason = (season: Season) => {
    setEditingSeasonId(season.id);
    setEditSeasonNumber(season.seasonNumber);
  };
  const cancelEditSeason = () => {
    setEditingSeasonId(null);
    setEditSeasonNumber(null);
  };
  const saveEditSeason = async (season: Season) => {
    if (editSeasonNumber == null || editSeasonNumber <= 0) return;
      setIsLoading(true);
    try {
      await updateSeason(season.id, { ...season, seasonNumber: editSeasonNumber });
      // Update local state immediately
      const updatedSeasons = seasons.map(s => 
        s.id === season.id ? { ...s, seasonNumber: editSeasonNumber } : s
      );
      onSeasonsUpdated?.(updatedSeasons);
      toast({ title: 'Season updated successfully', variant: 'success' });
      setEditingSeasonId(null);
      setEditSeasonNumber(null);
    } catch (error) {
      toast({ title: 'Failed to update season', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Inline episode edit handlers ---
  const startEditEpisode = (episode: Episode) => {
    setEditingEpisodeId(episode.id);
    setEditEpisodeData({
      ...episode,
      subtitle_urls: episode.subtitle_urls || {}
    });
    setSelectedSeason(seasons.find(s => s.episodes?.some(e => e.id === episode.id)) || null);
  };

  const handleEditEpisode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSeason || !editingEpisodeId || !editEpisodeData) return;
    
    const form = e.currentTarget as HTMLFormElement;
    const formData = {
      episodeNumber: parseInt((form.elements.namedItem('episodeNumber') as HTMLInputElement)?.value || '0'),
      title: (form.elements.namedItem('title') as HTMLInputElement)?.value || '',
      duration: (form.elements.namedItem('duration') as HTMLInputElement)?.value || '',
      master_url: (form.elements.namedItem('master_url') as HTMLInputElement)?.value || undefined,
      master_url_480p: (form.elements.namedItem('master_url_480p') as HTMLInputElement)?.value || undefined,
      master_url_720p: (form.elements.namedItem('master_url_720p') as HTMLInputElement)?.value || undefined,
      master_url_1080p: (form.elements.namedItem('master_url_1080p') as HTMLInputElement)?.value || undefined,
      videoUrl480p: (form.elements.namedItem('videoUrl480p') as HTMLInputElement)?.value || undefined,
      videoUrl720p: (form.elements.namedItem('videoUrl720p') as HTMLInputElement)?.value || undefined,
      videoUrl1080p: (form.elements.namedItem('videoUrl1080p') as HTMLInputElement)?.value || undefined,
      videoUrl4k: (form.elements.namedItem('videoUrl4k') as HTMLInputElement)?.value || undefined,
      subtitle_urls: JSON.parse((form.elements.namedItem('subtitle_urls') as HTMLTextAreaElement)?.value || '{}')
    };
    
    if (!formData.title || !formData.title.trim()) {
      setValidationErrors(prev => ({ ...prev, title: 'Title is required' }));
      return;
    }
    if (!validateForm(formData)) return;

    try {
      setIsLoading(true);
      const episodeData: Partial<Episode> = {
        ...formData,
        seasonId: selectedSeason.id,
        episodeNumber: formData.episodeNumber,
        master_url: formData.master_url || undefined,
        master_url_480p: formData.master_url_480p || undefined,
        master_url_720p: formData.master_url_720p || undefined,
        master_url_1080p: formData.master_url_1080p || undefined,
        videoUrl480p: formData.videoUrl480p || undefined,
        videoUrl720p: formData.videoUrl720p || undefined,
        videoUrl1080p: formData.videoUrl1080p || undefined,
        videoUrl4k: formData.videoUrl4k || undefined,
        subtitle_urls: formData.subtitle_urls || undefined
      };

      await updateEpisode(editingEpisodeId, episodeData);
      
      // Update local state immediately
      const updatedSeasons = seasons.map(season => ({
        ...season,
        episodes: (season.episodes || []).map(ep => 
          ep.id === editingEpisodeId ? { ...ep, ...episodeData } : ep
        )
      }));
      onSeasonsUpdated?.(updatedSeasons);
      toast({ title: 'Episode updated successfully', variant: 'success' });
      setEditingEpisodeId(null);
      setEditEpisodeData(null);
      setSelectedSeason(null);
    } catch (error) {
      toast({ 
        title: 'Failed to update episode', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelEditEpisode = () => {
    setEditingEpisodeId(null);
    setEditEpisodeData(null);
    setSelectedSeason(null);
  };

  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm('Are you sure you want to delete this season and all its episodes?')) return;
    
    try {
      setIsLoading(true);
      await deleteSeason(seasonId);
      toast({
        title: 'Season deleted successfully',
        variant: 'success'
      });
      onSeasonsUpdated?.();
    } catch (error) {
      toast({
        title: 'Failed to delete season',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm('Are you sure you want to delete this episode?')) return;
    
    try {
      setIsLoading(true);
      await deleteEpisode(episodeId);
      toast({
        title: 'Episode deleted successfully',
        variant: 'success'
      });
      onSeasonsUpdated?.();
    } catch (error) {
      toast({
        title: 'Failed to delete episode',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-black">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-black">Seasons & Episodes</h3>
        <Button 
          onClick={() => setIsAddingSeason(true)}
          className="gap-2 bg-red-600 hover:bg-red-700 text-white"
          disabled={isLoading}
        >
          <Plus size={16} />
          <span>Add Season</span>
        </Button>
      </div>

      {/* Add Season Form */}
      {isAddingSeason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 text-black">
          <form onSubmit={handleAddSeason} className="bg-white p-6 rounded-lg space-y-4 w-full max-w-md">
            <h4 className="font-semibold text-xl text-black mb-4">Add New Season</h4>
            
            <div className="space-y-2">
              <label htmlFor="seasonNumber" className="text-black font-medium">Season Number*</label>
              <Input
                id="seasonNumber"
                name="seasonNumber"
                type="number"
                min="1"
                required
                disabled={isLoading}
                className="text-black bg-white"
              />
              {validationErrors.seasonNumber && (
                <p className="text-sm text-red-500">{validationErrors.seasonNumber}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="title" className="text-black font-medium">Title</label>
              <Input
                id="title"
                name="title"
                type="text"
                disabled={isLoading}
                className="text-black bg-white"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="description" className="text-black font-medium">Description</label>
              <textarea
                id="description"
                name="description"
                className="text-black bg-white"
                rows="3"
                disabled={isLoading}
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddingSeason(false)}
                disabled={isLoading}
                className="text-black bg-white hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : 'Add Season'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Seasons List */}
      <div className="space-y-4">
        {seasons.length === 0 ? (
          <div className="text-center py-8 text-black bg-gray-50 rounded-lg">
            <p className="text-lg">No seasons added yet</p>
            <p className="text-sm text-gray-500 mt-2">Click "Add Season" to get started</p>
          </div>
        ) : (
          seasons
            .sort((a, b) => a.seasonNumber - b.seasonNumber)
            .map((season) => (
              editingSeasonId === season.id ? (
                <div key={season.id} className="bg-gray-50 p-4 flex items-center justify-between text-black rounded-lg">
                  <input 
                    type="number" 
                    value={editSeasonNumber ?? ''} 
                    onChange={e => setEditSeasonNumber(Number(e.target.value))} 
                    className="w-24 border rounded p-2 mr-2" 
                  />
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={() => saveEditSeason(season)} 
                      disabled={isLoading} 
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Save
                    </Button>
                    <Button 
                      onClick={cancelEditSeason} 
                      disabled={isLoading} 
                      className="bg-gray-200 hover:bg-gray-300 text-black"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={season.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div
                    className="bg-gray-50 p-4 flex items-center justify-between text-black hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => toggleSeason(season.id)}
                >
                  <div>
                    <h4 className="font-semibold text-black">
                        Season {season.seasonNumber}
                    </h4>
                      <div className="text-sm text-gray-600">
                      {season.episodes.length} episode{season.episodes.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSeason(season);
                        setIsAddingEpisode(true);
                      }}
                      title="Add Episode"
                      disabled={isLoading}
                        className="text-white bg-red-600 hover:bg-red-700"
                    >
                      <Plus size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                          startEditSeason(season);
                      }}
                      title="Edit Season"
                      disabled={isLoading}
                        className="text-black hover:bg-gray-200"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSeason(season.id);
                      }}
                      title="Delete Season"
                      disabled={isLoading}
                        className="text-red-600 hover:bg-red-50"
                    >
                      <Trash size={16} />
                    </Button>
                    {expandedSeasons.includes(season.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {expandedSeasons.includes(season.id) && (
                  <div className="p-4">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                            <th className="text-left py-2 font-medium">Episode</th>
                            <th className="text-left py-2 font-medium">Title</th>
                            <th className="text-left py-2 font-medium">Duration</th>
                            <th className="text-left py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(season.episodes || []).sort((a, b) => a.episodeNumber - b.episodeNumber).map((episode) => (
                                <tr key={episode.id} className="border-b hover:bg-gray-50">
                                  <td className="py-2">{episode.episodeNumber}</td>
                            <td className="py-2">{episode.title}</td>
                            <td className="py-2">{episode.duration}</td>
                            <td className="py-2">
                                    <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                        onClick={() => startEditEpisode(episode)}
                                  title="Edit Episode"
                                  disabled={isLoading}
                                        className="text-black hover:bg-gray-200"
                                >
                                  <Edit size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteEpisode(episode.id)}
                                  title="Delete Episode"
                                  disabled={isLoading}
                                        className="text-red-600 hover:bg-red-50"
                                >
                                  <Trash size={16} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )
            ))
        )}
      </div>

      {/* Add/Edit Episode Modal */}
      {(isAddingEpisode || editingEpisodeId) && selectedSeason && (
        <div className="fixed inset-0 bg-gradient-to-b from-black/70 to-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-b from-white to-gray-50/80 rounded-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100/50 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h4 className="text-2xl font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
                  {editingEpisodeId ? 'Edit Episode' : 'Add New Episode'}
            </h4>
                <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full text-xs font-medium text-gray-600 shadow-sm border border-gray-200/50">
                    Season {selectedSeason.seasonNumber}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span>{selectedSeason.title}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsAddingEpisode(false);
                  setSelectedSeason(null);
                  setEditingEpisodeId(null);
                  setEditEpisodeData(null);
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-colors"
              >
                <X size={20} />
              </Button>
            </div>
            
            <form onSubmit={editingEpisodeId ? handleEditEpisode : handleAddEpisode} className="space-y-8">
              {/* Basic Information Section */}
              <div className="bg-gradient-to-b from-gray-50/90 to-gray-50/70 rounded-xl p-6 space-y-6 border border-gray-200/80 shadow-sm hover:shadow-md transition-all duration-200">
                <h5 className="text-lg font-medium bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent flex items-center gap-2">
                  <span>Basic Information</span>
                  <span className="text-xs text-gray-500 bg-gradient-to-r from-gray-100 to-gray-50 px-2.5 py-1 rounded-full shadow-sm border border-gray-200/50">Required fields are marked with *</span>
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label htmlFor="episodeNumber" className="block text-sm font-medium text-gray-700">
                      Episode Number*
                    </label>
                  <Input
                    id="episodeNumber"
                    name="episodeNumber"
                    type="number"
                    min="1"
                    required
                    disabled={isLoading}
                      defaultValue={editEpisodeData?.episodeNumber}
                      className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      placeholder="e.g., 1"
                  />
                  {validationErrors.episodeNumber && (
                      <p className="text-sm text-red-500 mt-1">{validationErrors.episodeNumber}</p>
                  )}
                </div>
                <div className="space-y-2">
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Title*
                    </label>
                  <Input
                    id="title"
                    name="title"
                    type="text"
                    required
                    disabled={isLoading}
                      defaultValue={editEpisodeData?.title}
                      className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      placeholder="Enter episode title"
                  />
                  {validationErrors.title && (
                      <p className="text-sm text-red-500 mt-1">{validationErrors.title}</p>
                  )}
                </div>
                <div className="space-y-2">
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                      Duration*
                    </label>
                  <Input
                    id="duration"
                    name="duration"
                    type="text"
                    placeholder="e.g., 45m"
                    required
                    disabled={isLoading}
                      defaultValue={editEpisodeData?.duration}
                      className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                  />
                  {validationErrors.duration && (
                      <p className="text-sm text-red-500 mt-1">{validationErrors.duration}</p>
                  )}
                  </div>
                </div>
              </div>

              {/* Video Quality URLs Section */}
              <div className="bg-gradient-to-b from-gray-50/90 to-gray-50/70 rounded-xl p-6 space-y-6 border border-gray-200/80 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <h5 className="text-lg font-medium bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Video Quality URLs</h5>
                  <p className="text-sm text-gray-500 bg-gradient-to-r from-gray-100 to-gray-50 px-2.5 py-1 rounded-full shadow-sm border border-gray-200/50">At least one video URL is required</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="master_url" className="block text-sm font-medium text-gray-700">
                        Master URL
                      </label>
                      <Input
                        id="master_url"
                        name="master_url"
                        type="url"
                        placeholder="https://example.com/video_master_url.mp4"
                        disabled={isLoading}
                        defaultValue={editEpisodeData?.master_url}
                        className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      />
                      <p className="text-xs text-gray-500 mt-1">Highest quality source file</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="master_url_480p" className="block text-sm font-medium text-gray-700">
                        Master URL 480p
                      </label>
                      <Input
                        id="master_url_480p"
                        name="master_url_480p"
                        type="url"
                        placeholder="https://example.com/video_master_url_480p.mp4"
                        disabled={isLoading}
                        defaultValue={editEpisodeData?.master_url_480p}
                        className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="master_url_720p" className="block text-sm font-medium text-gray-700">
                        Master URL 720p
                      </label>
                      <Input
                        id="master_url_720p"
                        name="master_url_720p"
                        type="url"
                        placeholder="https://example.com/video_master_url_720p.mp4"
                        disabled={isLoading}
                        defaultValue={editEpisodeData?.master_url_720p}
                        className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="master_url_1080p" className="block text-sm font-medium text-gray-700">
                        Master URL 1080p
                      </label>
                      <Input
                        id="master_url_1080p"
                        name="master_url_1080p"
                        type="url"
                        placeholder="https://example.com/video_master_url_1080p.mp4"
                        disabled={isLoading}
                        defaultValue={editEpisodeData?.master_url_1080p}
                        className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      />
                    </div>
                  </div>
              <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="videoUrl480p" className="block text-sm font-medium text-gray-700">
                        480p URL
                      </label>
                      <Input
                        id="videoUrl480p"
                        name="videoUrl480p"
                        type="url"
                        placeholder="https://example.com/video_480p.mp4"
                        disabled={isLoading}
                        defaultValue={editEpisodeData?.videoUrl480p}
                        className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      />
                      <p className="text-xs text-gray-500 mt-1">Standard definition</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="videoUrl720p" className="block text-sm font-medium text-gray-700">
                        720p URL
                      </label>
                      <Input
                        id="videoUrl720p"
                        name="videoUrl720p"
                        type="url"
                        placeholder="https://example.com/video_720p.mp4"
                        disabled={isLoading}
                        defaultValue={editEpisodeData?.videoUrl720p}
                        className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      />
                      <p className="text-xs text-gray-500 mt-1">HD quality</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="videoUrl1080p" className="block text-sm font-medium text-gray-700">
                        1080p URL
                      </label>
                      <Input
                        id="videoUrl1080p"
                        name="videoUrl1080p"
                        type="url"
                        placeholder="https://example.com/video_1080p.mp4"
                        disabled={isLoading}
                        defaultValue={editEpisodeData?.videoUrl1080p}
                        className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      />
                      <p className="text-xs text-gray-500 mt-1">Full HD quality</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="videoUrl4k" className="block text-sm font-medium text-gray-700">
                        4K URL
                      </label>
                      <Input
                        id="videoUrl4k"
                        name="videoUrl4k"
                        type="url"
                        placeholder="https://example.com/video_4k.mp4"
                        disabled={isLoading}
                        defaultValue={editEpisodeData?.videoUrl4k}
                        className="w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
                      />
                      <p className="text-xs text-gray-500 mt-1">Ultra HD quality</p>
                    </div>
                  </div>
                </div>
              </div>

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
                      const form = document.querySelector('form');
                      const subtitleUrlsInput = form?.elements.namedItem('subtitle_urls') as HTMLTextAreaElement;
                      if (subtitleUrlsInput) {
                        subtitleUrlsInput.value = JSON.stringify({}, null, 2);
                      }
                    }}
                    className="text-sm bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm hover:shadow"
                  >
                    <Trash2 size={14} className="text-gray-500 group-hover:text-red-500" />
                    Clear All
                  </Button>
                </div>
                <div className="space-y-4">
                  <SubtitleManager
                    value={editEpisodeData?.subtitle_urls || {}}
                    onChange={(value) => {
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
                    defaultValue={JSON.stringify(editEpisodeData?.subtitle_urls || {}, null, 2)}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddingEpisode(false);
                    setSelectedSeason(null);
                    setEditingEpisodeId(null);
                    setEditEpisodeData(null);
                  }}
                  disabled={isLoading}
                  className="text-black bg-white hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : editingEpisodeId ? 'Save Changes' : 'Add Episode'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeriesManager;
