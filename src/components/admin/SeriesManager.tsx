import { useState, useEffect } from 'react';
import { Plus, Edit, Trash, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
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

  const validateForm = (formData: Record<string, string>): boolean => {
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
      const episodeNum = parseInt(formData.episodeNumber);
      if (isNaN(episodeNum)) {
        errors.episodeNumber = 'Invalid episode number';
      } else if (episodeNum <= 0) {
        errors.episodeNumber = 'Episode number must be positive';
      } else if (selectedSeason?.episodes.some(e => e.episodeNumber === episodeNum)) {
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
    };

    try {
      setIsLoading(true);
      setValidationErrors({});

      const seasonData = {
        seasonNumber: parseInt(formData.seasonNumber),
        seriesId: contentId
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
      episodeNumber: (form.elements.namedItem('episodeNumber') as HTMLInputElement)?.value,
      title: (form.elements.namedItem('title') as HTMLInputElement)?.value,
      duration: (form.elements.namedItem('duration') as HTMLInputElement)?.value,
      master_url: (form.elements.namedItem('master_url') as HTMLInputElement)?.value,
      master_url_480p: (form.elements.namedItem('master_url_480p') as HTMLInputElement)?.value,
      master_url_720p: (form.elements.namedItem('master_url_720p') as HTMLInputElement)?.value,
      master_url_1080p: (form.elements.namedItem('master_url_1080p') as HTMLInputElement)?.value,
      videoUrl480p: (form.elements.namedItem('videoUrl480p') as HTMLInputElement)?.value,
      videoUrl720p: (form.elements.namedItem('videoUrl720p') as HTMLInputElement)?.value,
      videoUrl1080p: (form.elements.namedItem('videoUrl1080p') as HTMLInputElement)?.value,
      videoUrl4k: (form.elements.namedItem('videoUrl4k') as HTMLInputElement)?.value,
      subtitle_urls: JSON.parse((form.elements.namedItem('subtitle_urls') as HTMLTextAreaElement)?.value || '{}')
    };
    
    if (!formData.title || !formData.title.trim()) {
      setValidationErrors(prev => ({ ...prev, title: 'Title is required' }));
      return;
    }
    if (!validateForm(formData)) return;

    try {
      setIsLoading(true);
      const newEpisode = await addEpisode(selectedSeason.id, {
        seasonId: selectedSeason.id,
        episodeNumber: parseInt(formData.episodeNumber),
        title: formData.title.trim(),
        duration: formData.duration,
        master_url: formData.master_url || undefined,
        master_url_480p: formData.master_url_480p || undefined,
        master_url_720p: formData.master_url_720p || undefined,
        master_url_1080p: formData.master_url_1080p || undefined,
        videoUrl480p: formData.videoUrl480p || undefined,
        videoUrl720p: formData.videoUrl720p || undefined,
        videoUrl1080p: formData.videoUrl1080p || undefined,
        videoUrl4k: formData.videoUrl4k || undefined,
        subtitle_urls: formData.subtitle_urls
      });
      // Update local state immediately
      const updatedSeasons = seasons.map(season => 
        season.id === selectedSeason.id
          ? { ...season, episodes: [...season.episodes, newEpisode] }
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
  };
  const cancelEditEpisode = () => {
    setEditingEpisodeId(null);
    setEditEpisodeData(null);
  };
  const saveEditEpisode = async (episode: Episode) => {
    if (!editEpisodeData) return;
    setIsLoading(true);
    try {
      await updateEpisode(episode.id, {
        ...editEpisodeData,
        master_url: editEpisodeData.master_url || undefined,
        master_url_480p: editEpisodeData.master_url_480p || undefined,
        master_url_720p: editEpisodeData.master_url_720p || undefined,
        master_url_1080p: editEpisodeData.master_url_1080p || undefined,
        videoUrl480p: editEpisodeData.videoUrl480p || undefined,
        videoUrl720p: editEpisodeData.videoUrl720p || undefined,
        videoUrl1080p: editEpisodeData.videoUrl1080p || undefined,
        videoUrl4k: editEpisodeData.videoUrl4k || undefined,
        subtitle_urls: editEpisodeData.subtitle_urls || undefined
      });
      // Update local state immediately
      const updatedSeasons = seasons.map(season => ({
        ...season,
        episodes: season.episodes.map(ep => 
          ep.id === episode.id ? { ...ep, ...editEpisodeData } : ep
        )
      }));
      onSeasonsUpdated?.(updatedSeasons);
      toast({ title: 'Episode updated successfully', variant: 'success' });
      setEditingEpisodeId(null);
      setEditEpisodeData(null);
    } catch (error) {
      toast({ title: 'Failed to update episode', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
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
                        {season.episodes
                            .sort((a, b) => (a.episodeNumber) - (b.episodeNumber))
                          .map((episode) => (
                              editingEpisodeId === episode.id ? (
                                <tr key={episode.id} className="border-b bg-gray-50">
                                  <td className="py-2"><input type="number" value={editEpisodeData?.episodeNumber ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, episodeNumber: Number(e.target.value) } : d)} className="w-16 border rounded p-2" /></td>
                                  <td className="py-2"><input type="text" value={editEpisodeData?.title ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, title: e.target.value } : d)} className="w-32 border rounded p-2" /></td>
                                  <td className="py-2"><input type="text" value={editEpisodeData?.duration ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, duration: e.target.value } : d)} className="w-20 border rounded p-2" /></td>
                                  <td className="py-2">
                                    <div className="space-y-2">
                                      <input type="url" placeholder="Master URL" value={editEpisodeData?.master_url ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, master_url: e.target.value } : d)} className="w-24 border rounded p-2" />
                                      <input type="url" placeholder="Master URL 480p" value={editEpisodeData?.master_url_480p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, master_url_480p: e.target.value } : d)} className="w-24 border rounded p-2" />
                                      <input type="url" placeholder="Master URL 720p" value={editEpisodeData?.master_url_720p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, master_url_720p: e.target.value } : d)} className="w-24 border rounded p-2" />
                                      <input type="url" placeholder="Master URL 1080p" value={editEpisodeData?.master_url_1080p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, master_url_1080p: e.target.value } : d)} className="w-24 border rounded p-2" />
                                      <input type="url" placeholder="480p" value={editEpisodeData?.videoUrl480p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, videoUrl480p: e.target.value } : d)} className="w-24 border rounded p-2" />
                                      <input type="url" placeholder="720p" value={editEpisodeData?.videoUrl720p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, videoUrl720p: e.target.value } : d)} className="w-24 border rounded p-2" />
                                      <input type="url" placeholder="1080p" value={editEpisodeData?.videoUrl1080p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, videoUrl1080p: e.target.value } : d)} className="w-24 border rounded p-2" />
                                      <input type="url" placeholder="4K" value={editEpisodeData?.videoUrl4k ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, videoUrl4k: e.target.value } : d)} className="w-24 border rounded p-2" />
                                      <div className="mt-4">
                                        <label className="block text-sm font-medium text-black mb-2">Subtitles</label>
                                        <SubtitleManager
                                          value={editEpisodeData?.subtitle_urls || {}}
                                          onChange={(value) => {
                                            setEditEpisodeData(d => d ? {
                                              ...d,
                                              subtitle_urls: value
                                            } : d);
                                          }}
                                          disabled={isLoading}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2">
                                    <Button onClick={() => saveEditEpisode(episode)} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white mr-1">Save</Button>
                                    <Button onClick={cancelEditEpisode} disabled={isLoading} className="bg-gray-200 hover:bg-gray-300 text-black">Cancel</Button>
                                  </td>
                                </tr>
                              ) : (
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
                              )
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

      {/* Add Episode Modal */}
      {isAddingEpisode && selectedSeason && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-semibold mb-4">
              Add New Episode to Season {selectedSeason.seasonNumber}
            </h4>
            
            <form onSubmit={handleAddEpisode} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="episodeNumber">Episode Number*</label>
                  <Input
                    id="episodeNumber"
                    name="episodeNumber"
                    type="number"
                    min="1"
                    required
                    disabled={isLoading}
                    className="text-black"
                  />
                  {validationErrors.episodeNumber && (
                    <p className="text-sm text-red-500">{validationErrors.episodeNumber}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="title">Title*</label>
                  <Input
                    id="title"
                    name="title"
                    type="text"
                    required
                    disabled={isLoading}
                    className="text-black"
                  />
                  {validationErrors.title && (
                    <p className="text-sm text-red-500">{validationErrors.title}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="duration">Duration*</label>
                  <Input
                    id="duration"
                    name="duration"
                    type="text"
                    placeholder="e.g., 45m"
                    required
                    disabled={isLoading}
                    className="text-black"
                  />
                  {validationErrors.duration && (
                    <p className="text-sm text-red-500">{validationErrors.duration}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="font-medium">Video Quality URLs</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videoQualities.map(quality => (
                    <div key={quality} className="space-y-2">
                      <label htmlFor={`videoUrl${quality}`}>{quality} URL</label>
                      <Input
                        id={`videoUrl${quality}`}
                        name={`videoUrl${quality}`}
                        type="url"
                        placeholder={`https://example.com/video_${quality}.mp4`}
                        disabled={isLoading}
                        className="text-black"
                      />
                      {validationErrors[`videoUrl${quality}`] && (
                        <p className="text-sm text-red-500">
                          {validationErrors[`videoUrl${quality}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Subtitle URLs */}
              <div className="space-y-4">
                <h5 className="font-medium">Subtitles</h5>
                <div className="space-y-4">
                  <SubtitleManager
                    value={{}}
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
                    defaultValue="{}"
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
                  {isLoading ? <Loader2 className="animate-spin" /> : 'Add Episode'}
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
