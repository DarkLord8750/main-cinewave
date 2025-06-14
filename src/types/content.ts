export interface CastMember {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
}

export interface Content {
  id: string;
  title: string;
  description: string;
  releaseYear: number;
  maturityRating: string;
  genre: string[];
  cast?: CastMember[];
  posterImage: string;
  backdropImage?: string;
  videoUrl1080p?: string;
  videoUrl720p?: string;
  videoUrl480p?: string;
  videoUrl4k?: string;
  type: 'movie' | 'series';
} 