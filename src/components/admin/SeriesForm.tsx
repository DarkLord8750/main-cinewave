import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { Content } from '../../stores/contentStore';
import { validateSeason, validateEpisode } from '../../utils/contentValidation';
import { useToast } from '../ui/use-toast';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface SeriesFormProps {
  initialData?: Content;
  onSave: (seriesData: SeriesFormData) => Promise<void>;
  onCancel: () => void;
}

interface SeriesFormData {
  title: string;
  description: string;
  type: 'series';
  releaseYear: number;
  maturityRating: string;
  posterImage: string;
  backdropImage: string;
  trailerUrl: string;
  featured: boolean;
  genre: string[];
  seasons: SeasonFormData[];
}

interface SeasonFormData {
  id?: string;
  seasonNumber: number;
  episodes: EpisodeFormData[];
}

interface EpisodeFormData {
  id?: string;
  episodeNumber: number;
  title: string;
  duration: string;
  videoUrl480p?: string;
  videoUrl720p?: string;
  videoUrl1080p?: string;
  videoUrl4k?: string;
}

const defaultEpisode: Omit<EpisodeFormData, 'episodeNumber'> = {
  title: '',
  duration: '',
  videoUrl480p: '',
  videoUrl720p: '',
  videoUrl1080p: '',
  videoUrl4k: ''
};

const SeriesForm = ({ initialData, onSave, onCancel }: SeriesFormProps) => {
  const [formData, setFormData] = useState<SeriesFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    type: 'series',
    releaseYear: initialData?.releaseYear || new Date().getFullYear(),
    maturityRating: initialData?.maturityRating || '',
    posterImage: initialData?.posterImage || '',
    backdropImage: initialData?.backdropImage || '',
    trailerUrl: initialData?.trailerUrl || '',
    featured: initialData?.featured || false,
    genre: initialData?.genre || [],
    seasons: initialData?.seasons?.map(season => ({
      id: season.id,
      seasonNumber: season.seasonNumber,
      episodes: season.episodes.map(episode => ({
        id: episode.id,
        episodeNumber: episode.episodeNumber,
        title: episode.title || '',
        duration: episode.duration,
        videoUrl480p: episode.videoUrl480p,
        videoUrl720p: episode.videoUrl720p,
        videoUrl1080p: episode.videoUrl1080p,
        videoUrl4k: episode.videoUrl4k
      }))
    })) || []
  });

  const [expandedSeasons, setExpandedSeasons] = useState<number[]>([]);
  const [expandedEpisodes, setExpandedEpisodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [isAddingSeason, setIsAddingSeason] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<{seasonIndex: number, episodeIndex: number} | null>(null);
  const [editEpisodeData, setEditEpisodeData] = useState<EpisodeFormData | null>(null);

  useEffect(() => {
    // Expand first season by default when creating new series
    if (!initialData && formData.seasons.length > 0) {
      setExpandedSeasons([0]);
    }
  }, [initialData, formData.seasons]);

  const toggleSeason = (index: number) => {
    setExpandedSeasons(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const toggleEpisode = (seasonIndex: number, episodeIndex: number) => {
    const key = `${seasonIndex}-${episodeIndex}`;
    setExpandedEpisodes(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const addEpisode = (seasonIndex: number) => {
    const season = formData.seasons[seasonIndex];
    const newEpisodeNumber = season.episodes.length > 0
      ? Math.max(...season.episodes.map(e => e.episodeNumber)) + 1
      : 1;

    const newEpisode: EpisodeFormData = {
      ...defaultEpisode,
      episodeNumber: newEpisodeNumber,
      title: 'Untitled'
    };

    setFormData(prev => ({
      ...prev,
      seasons: prev.seasons.map((s, i) =>
        i === seasonIndex
          ? { ...s, episodes: [...s.episodes, newEpisode] }
          : s
      )
    }));

    toggleEpisode(seasonIndex, season.episodes.length);
  };

  const removeSeason = (index: number) => {
    if (confirm('Are you sure you want to remove this season and all its episodes?')) {
      setFormData(prev => ({
        ...prev,
        seasons: prev.seasons.filter((_, i) => i !== index)
      }));
      setExpandedSeasons(prev => prev.filter(i => i !== index));
    }
  };

  const removeEpisode = (seasonIndex: number, episodeIndex: number) => {
    if (confirm('Are you sure you want to remove this episode?')) {
      setFormData(prev => ({
        ...prev,
        seasons: prev.seasons.map((season, i) =>
          i === seasonIndex
            ? {
                ...season,
                episodes: season.episodes.filter((_, j) => j !== episodeIndex)
              }
            : season,
        )
      }));
      const key = `${seasonIndex}-${episodeIndex}`;
      setExpandedEpisodes(prev => prev.filter(k => k !== key));
    }
  };

  const startEditEpisode = (seasonIndex: number, episodeIndex: number) => {
    const episode = formData.seasons[seasonIndex].episodes[episodeIndex];
    setEditingEpisode({ seasonIndex, episodeIndex });
    setEditEpisodeData({ ...episode });
  };

  const cancelEditEpisode = () => {
    setEditingEpisode(null);
    setEditEpisodeData(null);
  };

  const saveEditEpisode = () => {
    if (!editingEpisode || !editEpisodeData) return;
    setFormData(prev => ({
      ...prev,
      seasons: prev.seasons.map((season, sIdx) =>
        sIdx === editingEpisode.seasonIndex
          ? {
              ...season,
              episodes: season.episodes.map((ep, eIdx) =>
                eIdx === editingEpisode.episodeIndex ? { ...editEpisodeData } : ep
              )
            }
          : season
      )
    }));
    setEditingEpisode(null);
    setEditEpisodeData(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    formData.seasons.forEach((season, seasonIndex) => {
      const seasonValidation = validateSeason(season);
      if (!seasonValidation.isValid) {
        seasonValidation.errors.forEach(error => {
          newErrors[`season-${seasonIndex}-${error.field}`] = error.message;
        });
      }

      season.episodes.forEach((episode, episodeIndex) => {
        const episodeValidation = validateEpisode(episode);
        if (!episodeValidation.isValid) {
          episodeValidation.errors.forEach(error => {
            newErrors[`episode-${seasonIndex}-${episodeIndex}-${error.field}`] = error.message;
          });
        }
      });
    });

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      toast({
        title: 'Success',
        description: 'Series data saved successfully',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error saving series:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save series',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSeason = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const seasonNumber = parseInt((form.elements.namedItem('seasonNumber') as HTMLInputElement).value);

    if (isNaN(seasonNumber) || seasonNumber <= 0) {
      toast({
        title: 'Invalid Season Number',
        description: 'Please enter a valid season number',
        variant: 'destructive'
      });
      return;
    }

    // Check if season number already exists
    if (formData.seasons.some(s => s.seasonNumber === seasonNumber)) {
      toast({
        title: 'Season Already Exists',
        description: 'A season with this number already exists',
        variant: 'destructive'
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      seasons: [...prev.seasons, {
        seasonNumber,
        episodes: []
      }]
    }));

    setIsAddingSeason(false);
  };

  return (
    <div className="space-y-6 text-black">
      {/* Seasons List */}
      <div className="space-y-4">
        {formData.seasons.length === 0 ? (
          <div className="text-center py-8 text-black">
            No seasons added yet
          </div>
        ) : (
          formData.seasons
            .sort((a, b) => a.seasonNumber - b.seasonNumber)
            .map((season, seasonIndex) => (
              <div key={seasonIndex} className="border rounded-lg overflow-hidden text-black">
                {/* Season Header */}
                <div className="bg-gray-50 p-4 flex items-center justify-between text-black">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={`Season ${season.seasonNumber}`}
                      readOnly
                      className="w-full bg-transparent border-0 focus:ring-0 text-black placeholder-gray-600"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => addEpisode(seasonIndex)}
                      className="p-2 hover:bg-gray-200 rounded-full text-black"
                      title="Add Episode"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSeason(seasonIndex)}
                      className="p-2 hover:bg-gray-200 rounded-full text-red-500"
                      title="Remove Season"
                    >
                      <X size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSeason(seasonIndex)}
                      className="p-2 hover:bg-gray-200 rounded-full text-black"
                    >
                      {expandedSeasons.includes(seasonIndex) ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Season Content */}
                {expandedSeasons.includes(seasonIndex) && (
                  <div className="p-4 space-y-4">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-2">Episode</th>
                          <th className="text-left py-2">Title</th>
                          <th className="text-left py-2">Duration</th>
                          <th className="text-left py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                      {season.episodes.map((episode, episodeIndex) => (
                          editingEpisode && editingEpisode.seasonIndex === seasonIndex && editingEpisode.episodeIndex === episodeIndex ? (
                            <tr key={episodeIndex} className="border-b bg-gray-50">
                              <td className="py-2"><input type="number" value={editEpisodeData?.episodeNumber ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, episodeNumber: Number(e.target.value) } : d)} className="w-16 border rounded p-1" /></td>
                              <td className="py-2"><input type="text" value={editEpisodeData?.title ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, title: e.target.value } : d)} className="w-32 border rounded p-1" /></td>
                              <td className="py-2"><input type="text" value={editEpisodeData?.duration ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, duration: e.target.value } : d)} className="w-20 border rounded p-1" /></td>
                              <td className="py-2">
                                <input type="url" placeholder="480p" value={editEpisodeData?.videoUrl480p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, videoUrl480p: e.target.value } : d)} className="w-24 border rounded p-1 mb-1" />
                                <input type="url" placeholder="720p" value={editEpisodeData?.videoUrl720p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, videoUrl720p: e.target.value } : d)} className="w-24 border rounded p-1 mb-1" />
                                <input type="url" placeholder="1080p" value={editEpisodeData?.videoUrl1080p ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, videoUrl1080p: e.target.value } : d)} className="w-24 border rounded p-1 mb-1" />
                                <input type="url" placeholder="4K" value={editEpisodeData?.videoUrl4k ?? ''} onChange={e => setEditEpisodeData(d => d ? { ...d, videoUrl4k: e.target.value } : d)} className="w-24 border rounded p-1" />
                              </td>
                              <td className="py-2">
                                <button type="button" onClick={saveEditEpisode} className="px-2 py-1 bg-green-500 text-white rounded mr-1">Save</button>
                                <button type="button" onClick={cancelEditEpisode} className="px-2 py-1 bg-gray-300 rounded">Cancel</button>
                              </td>
                            </tr>
                          ) : (
                            <tr key={episodeIndex} className="border-b">
                              <td className="py-2">{episode.episodeNumber}</td>
                              <td className="py-2">{episode.title || 'Untitled'}</td>
                              <td className="py-2">{episode.duration}</td>
                              <td className="py-2">
                                <div className="flex flex-col gap-1">
                                  <span>480p: {episode.videoUrl480p || '-'}</span>
                                  <span>720p: {episode.videoUrl720p || '-'}</span>
                                  <span>1080p: {episode.videoUrl1080p || '-'}</span>
                                  <span>4K: {episode.videoUrl4k || '-'}</span>
                                </div>
                              </td>
                              <td className="py-2">
                                <div className="flex items-center space-x-2">
                                  <button type="button" onClick={() => removeEpisode(seasonIndex, episodeIndex)} className="p-1 hover:bg-gray-200 rounded-full text-red-500"><X size={14} /></button>
                                  <button type="button" onClick={() => toggleEpisode(seasonIndex, episodeIndex)} className="p-1 hover:bg-gray-200 rounded-full text-black">{expandedEpisodes.includes(`${seasonIndex}-${episodeIndex}`) ? (<ChevronUp size={14} />) : (<ChevronDown size={14} />)}</button>
                                  <button type="button" onClick={() => startEditEpisode(seasonIndex, episodeIndex)} className="p-1 hover:bg-gray-200 rounded-full text-blue-500">Edit</button>
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
            ))
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-black">Seasons & Episodes</h3>
          <Button 
            onClick={() => setIsAddingSeason(true)}
            className="gap-2 text-black"
            disabled={isLoading}
          >
            <Plus size={16} />
            <span>Add Season</span>
          </Button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-netflix-red hover:bg-netflix-red/90 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Series'
            )}
          </button>
        </div>
      </div>

      {/* Add Season Form */}
      {isAddingSeason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 text-black">
          <form onSubmit={handleAddSeason} className="bg-white p-4 rounded-lg space-y-4 w-full max-w-2xl">
            <h4 className="font-semibold text-black">Add New Season</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seasonNumber" className="text-black font-medium">Season Number*</Label>
                <Input
                  id="seasonNumber"
                  name="seasonNumber"
                  type="number"
                  min="1"
                  required
                  disabled={isLoading}
                  className="text-black bg-white"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddingSeason(false)}
                disabled={isLoading}
                className="text-black bg-white"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="text-white">
                {isLoading ? <Loader2 className="animate-spin" /> : 'Add Season'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SeriesForm;