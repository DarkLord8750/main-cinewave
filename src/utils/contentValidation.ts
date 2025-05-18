import { Content} from '../stores/contentStore';

interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export const validateContent = (content: Partial<Content>): ValidationResult => {
  const errors: ValidationError[] = [];

  // Required fields validation
  const requiredFields = [
    { field: 'title', label: 'Title' },
    { field: 'description', label: 'Description' },
    { field: 'type', label: 'Content Type' },
    { field: 'releaseYear', label: 'Release Year' },
    { field: 'maturityRating', label: 'Maturity Rating' },
    { field: 'posterImage', label: 'Poster Image' },
    { field: 'backdropImage', label: 'Backdrop Image' },
    { field: 'trailerUrl', label: 'Trailer URL' },
  ];

  requiredFields.forEach(({ field, label }) => {
    if (!content[field as keyof Content]) {
      errors.push({
        field,
        message: `${label} is required`
      });
    }
  });

  // Type validation
  if (content.type && !['movie', 'series'].includes(content.type)) {
    errors.push({
      field: 'type',
      message: 'Content type must be either "movie" or "series"'
    });
  }

  // Release year validation
  if (content.releaseYear) {
    const currentYear = new Date().getFullYear();
    if (content.releaseYear < 1900 || content.releaseYear > currentYear + 5) {
      errors.push({
        field: 'releaseYear',
        message: `Release year must be between 1900 and ${currentYear + 5}`
      });
    }
  }

  // URL validations
  const urlFields = [
    { field: 'posterImage', label: 'Poster Image' },
    { field: 'backdropImage', label: 'Backdrop Image' },
    { field: 'trailerUrl', label: 'Trailer URL' },
    { field: 'videoUrl480p', label: '480p Video' },
    { field: 'videoUrl720p', label: '720p Video' },
    { field: 'videoUrl1080p', label: '1080p Video' },
    { field: 'videoUrl4k', label: '4K Video' },
  ];

  urlFields.forEach(({ field, label }) => {
    const url = content[field as keyof Content];
    if (url && typeof url === 'string') {
      try {
        new URL(url);
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          errors.push({
            field,
            message: `${label} URL must start with http:// or https://`
          });
        }
      } catch {
        errors.push({
          field,
          message: `${label} URL is invalid`
        });
      }
    }
  });

  // Genre validation
  if (content.genre && (!Array.isArray(content.genre) || content.genre.length === 0)) {
    errors.push({
      field: 'genre',
      message: 'At least one genre must be selected'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

interface SeasonFormData {
  id?: string;
  seasonNumber: number;
  episodes: EpisodeFormData[];
}

interface EpisodeFormData {
  id?: string;
  episodeNumber: number;
  duration: string;
  videoUrl480p?: string;
  videoUrl720p?: string;
  videoUrl1080p?: string;
  videoUrl4k?: string;
}

export const validateSeason = (season: SeasonFormData): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!season.seasonNumber || season.seasonNumber < 1) {
    errors.push({ field: 'seasonNumber', message: 'Season number must be positive' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateEpisode = (episode: EpisodeFormData): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!episode.episodeNumber || episode.episodeNumber < 1) {
    errors.push({ field: 'episodeNumber', message: 'Episode number must be positive' });
  }
  if (!episode.duration?.trim()) {
    errors.push({ field: 'duration', message: 'Duration is required' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};