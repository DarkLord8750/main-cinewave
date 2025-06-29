import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface Content {
  id: string;
  title: string;
  description: string;
  type: 'movie' | 'series';
  genre: string[];
  releaseYear: number;
  maturityRating: string;
  posterImage: string;
  backdropImage: string;
  trailerUrl: string;
  featured: boolean;
  master_url?: string;
  master_url_480p?: string;
  master_url_720p?: string;
  master_url_1080p?: string;
  videoUrl480p?: string;
  videoUrl720p?: string;
  videoUrl1080p?: string;
  videoUrl4k?: string;
  subtitle_urls?: { [key: string]: string };
  seasons?: Season[];
  cast: CastMember[];
  createdAt: string;
  duration?: string;
}

export interface Season {
  id: string;
  seasonNumber: number;
  seriesId?: string;
  episodes?: Episode[];
  title?: string;
  description?: string | null;
}

export interface Episode {
  id: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  description?: string;
  duration: string;
  thumbnail?: string;
  master_url?: string;
  master_url_480p?: string;
  master_url_720p?: string;
  master_url_1080p?: string;
  videoUrl480p?: string;
  videoUrl720p?: string;
  videoUrl1080p?: string;
  videoUrl4k?: string;
  subtitle_urls?: { [key: string]: string };
}

export interface CastMember {
  id: string;
  name: string;
  photoUrl: string;
  role: string;
}

interface ContentGenre {
  genres: {
    name: string;
  };
}

interface ContentCastMember {
  cast_members: {
    id: string;
    name: string;
    photo_url: string;
  };
  role: string;
  order: number;
}

interface ContentState {
  contents: Content[];
  featuredContents: Content[];
  myList: string[];
  isLoading: boolean;
  error: string | null;
  fetchContents: () => Promise<void>;
  fetchFeaturedContents: () => Promise<void>;
  getContentById: (id: string) => Content | undefined;
  getContentsByGenre: (genre: string) => Content[];
  searchContents: (query: string) => Content[];
  addToMyList: (contentId: string) => void;
  removeFromMyList: (contentId: string) => void;
  isInMyList: (contentId: string) => boolean;
  getMyListContents: () => Content[];
  addContent: (content: Omit<Content, 'id' | 'cast' | 'createdAt'>) => Promise<Content>;
  updateContent: (id: string, content: Partial<Content>) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;
  addSeason: (contentId: string, season: Omit<Season, 'id' | 'episodes'>) => Promise<Season>;
  updateSeason: (seasonId: string, season: Partial<Season>) => Promise<void>;
  deleteSeason: (seasonId: string) => Promise<void>;
  addEpisode: (seasonId: string, episode: Omit<Episode, 'id'>) => Promise<Episode>;
  updateEpisode: (episodeId: string, episode: Partial<Episode>) => Promise<void>;
  deleteEpisode: (episodeId: string) => Promise<void>;
}

export const useContentStore = create<ContentState>()(
  persist(
    (set, get) => ({
      contents: [],
      featuredContents: [],
      myList: [],
      isLoading: false,
      error: null,

      fetchContents: async () => {
        set({ isLoading: true, error: null });
        try {
          const { data: contents, error: contentError } = await supabase
            .from('content')
            .select(`
              *,
              content_genres (
                genres (name)
              ),
              content_cast (
                cast_member_id,
                role,
                order,
                cast_members (
                  id,
                  name,
                  photo_url
                )
              ),
              series (
                id,
                seasons (
                  *,
                  episodes (*)
                )
              )
            `)
            .order('created_at', { ascending: false });

          if (contentError) {
            throw new Error(contentError.message);
          }

          if (!contents) {
            throw new Error('No content data received from the server');
          }

          const formattedContents = contents.map(content => ({
            id: content.id,
            title: content.title,
            description: content.description,
            type: content.type,
            genre: content.content_genres?.map((cg: ContentGenre) => cg.genres.name) || [],
            releaseYear: content.release_year,
            maturityRating: content.maturity_rating,
            posterImage: content.poster_image,
            backdropImage: content.backdrop_image,
            trailerUrl: content.trailer_url,
            master_url: content.master_url,
            master_url_480p: content.master_url_480p,
            master_url_720p: content.master_url_720p,
            master_url_1080p: content.master_url_1080p,
            videoUrl480p: content.video_url_480p,
            videoUrl720p: content.video_url_720p,
            videoUrl1080p: content.video_url_1080p,
            videoUrl4k: content.video_url_4k,
            featured: content.featured,
            subtitle_urls: content.subtitle_urls,
            duration: content.duration,
            seasons: (content.series?.[0]?.seasons || []).map((season: any) => ({
              id: season.id,
              seriesId: season.series_id,
              seasonNumber: season.season_number,
              episodes: (season.episodes || []).map((episode: any) => ({
                id: episode.id,
                seasonId: episode.season_id,
                episodeNumber: episode.episode_number,
                title: episode.title || '',
                duration: episode.duration || '',
                thumbnail: episode.thumbnail,
                master_url: episode.master_url,
                master_url_480p: episode.master_url_480p,
                master_url_720p: episode.master_url_720p,
                master_url_1080p: episode.master_url_1080p,
                videoUrl480p: episode.video_url_480p,
                videoUrl720p: episode.video_url_720p,
                videoUrl1080p: episode.video_url_1080p,
                videoUrl4k: episode.video_url_4k,
                subtitle_urls: episode.subtitle_urls
              }))
            })),
            cast: content.content_cast?.
              sort((a: ContentCastMember, b: ContentCastMember) => a.order - b.order)
              .map((cc: ContentCastMember) => ({
                id: cc.cast_members.id,
                name: cc.cast_members.name,
                photoUrl: cc.cast_members.photo_url,
                role: cc.role
              })) || [],
            createdAt: content.created_at
          }));

          set({ contents: formattedContents, isLoading: false, error: null });
          await get().fetchFeaturedContents();
        } catch (error) {
          console.error('Error fetching content:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch content', 
            isLoading: false,
            contents: [] // Clear contents on error
          });
        }
      },

      fetchFeaturedContents: async () => {
        try {
          const { data: featured, error } = await supabase
            .from('content')
            .select(`
              *,
              content_genres (
                genres (name)
              ),
              content_cast (
                cast_member_id,
                role,
                order,
                cast_members (
                  id,
                  name,
                  photo_url
                )
              )
            `)
            .eq('featured', true)
            .order('featured_order', { ascending: true });

          if (error) throw error;

          const formattedFeatured = featured.map(content => ({
            id: content.id,
            title: content.title,
            description: content.description,
            type: content.type,
            genre: content.content_genres.map((cg: ContentGenre) => cg.genres.name),
            releaseYear: content.release_year,
            maturityRating: content.maturity_rating,
            posterImage: content.poster_image,
            backdropImage: content.backdrop_image,
            trailerUrl: content.trailer_url,
            master_url: content.master_url,
            master_url_480p: content.master_url_480p,
            master_url_720p: content.master_url_720p,
            master_url_1080p: content.master_url_1080p,
            videoUrl480p: content.video_url_480p,
            videoUrl720p: content.video_url_720p,
            videoUrl1080p: content.video_url_1080p,
            videoUrl4k: content.video_url_4k,
            featured: content.featured,
            subtitle_urls: content.subtitle_urls,
            cast: content.content_cast
              .sort((a: ContentCastMember, b: ContentCastMember) => a.order - b.order)
              .map((cc: ContentCastMember) => ({
                id: cc.cast_members.id,
                name: cc.cast_members.name,
                photoUrl: cc.cast_members.photo_url,
                role: cc.role
              })),
            createdAt: content.created_at
          }));

          set({ featuredContents: formattedFeatured });
        } catch (error) {
          console.error('Error fetching featured content:', error);
        }
      },

      getContentById: (id: string) => {
        return get().contents.find(content => content.id === id);
      },

      getContentsByGenre: (genre: string) => {
        return get().contents.filter(content => 
          content.genre.includes(genre)
        );
      },

      searchContents: (query: string) => {
        const searchQuery = query.toLowerCase().trim();
        if (!searchQuery) return [];

        return get().contents.filter(content => {
          const titleMatch = content.title.toLowerCase().includes(searchQuery);
          const descriptionMatch = content.description.toLowerCase().includes(searchQuery);
          const genreMatch = content.genre.some(genre => 
            genre.toLowerCase().includes(searchQuery)
          );
          
          return titleMatch || descriptionMatch || genreMatch;
        });
      },

      addToMyList: (contentId: string) => {
        set(state => ({
          myList: [...state.myList, contentId]
        }));
      },

      removeFromMyList: (contentId: string) => {
        set(state => ({
          myList: state.myList.filter(id => id !== contentId)
        }));
      },

      isInMyList: (contentId: string) => {
        return get().myList.includes(contentId);
      },

      getMyListContents: () => {
        return get().contents.filter(content => 
          get().myList.includes(content.id)
        );
      },

      addContent: async (content: Omit<Content, 'id' | 'cast' | 'createdAt'>) => {
        try {
          // Insert content
          const { data: newContent, error: contentError } = await supabase
            .from('content')
            .insert({
              title: content.title,
              description: content.description,
              type: content.type,
              release_year: content.releaseYear,
              maturity_rating: content.maturityRating,
              duration: content.duration,
              poster_image: content.posterImage,
              backdrop_image: content.backdropImage,
              trailer_url: content.trailerUrl,
              featured: content.featured
            })
            .select()
            .single();
          if (contentError) throw contentError;

          // Always create a series row if content is a series
          let seriesId = null;
          if (content.type === 'series') {
            const { data: series, error: seriesError } = await supabase
              .from('series')
              .insert({ content_id: newContent.id })
              .select('id')
              .single();
            if ((seriesError && (seriesError.code === '23505' || seriesError.code === 'PGRST116')) || !series) {
              // 23505 is unique_violation, PGRST116 is no rows returned
              const { data: existingSeries, error: fetchError } = await supabase
                .from('series')
                .select('id')
                .eq('content_id', newContent.id)
                .single();
              if (fetchError) throw fetchError;
              if (!existingSeries) throw new Error('Series not found or could not be created.');
              seriesId = existingSeries.id;
            } else if (seriesError) {
              throw seriesError;
            } else {
              seriesId = series.id;
            }
          }

          // Handle series-specific data
          if (content.type === 'series' && content.seasons && content.seasons.length > 0) {
            // Add seasons and episodes
            for (const season of content.seasons ?? []) {
              // Create season
              const { data: createdSeason, error: seasonError } = await supabase
                .from('seasons')
                .insert({
                  series_id: seriesId,
                  season_number: season.seasonNumber
                })
                .select()
                .single();

              if (seasonError) throw seasonError;
              if (!createdSeason) throw new Error('Failed to create season');

              // Add episodes for this season
              if (season.episodes && season.episodes.length > 0) {
                const episodeInserts = season.episodes.map((episode: any) => ({
                  season_id: createdSeason.id,
                  episode_number: episode.episodeNumber,
                  title: episode.title,
                  duration: episode.duration,
                  thumbnail: episode.thumbnail,
                  master_url: episode.master_url,
                  master_url_480p: episode.master_url_480p,
                  master_url_720p: episode.master_url_720p,
                  master_url_1080p: episode.master_url_1080p,
                  video_url_480p: episode.videoUrl480p,
                  video_url_720p: episode.videoUrl720p,
                  video_url_1080p: episode.videoUrl1080p,
                  video_url_4k: episode.videoUrl4k,
                  subtitle_urls: episode.subtitle_urls
                }));
                const { error: episodesError } = await supabase
                  .from('episodes')
                  .insert(episodeInserts);
                if (episodesError) throw episodesError;
              }
            }
          }

          // Return the new content object (with duration)
          return {
            ...content,
            id: newContent.id,
            cast: [],
            createdAt: newContent.created_at,
          };
        } catch (error) {
          console.error('Error adding content:', error);
          throw error;
        }
      },

      updateContent: async (id: string, content: Partial<Content>) => {
        try {
          // Update main content
          const { error: contentError } = await supabase
            .from('content')
            .update({
              title: content.title,
              description: content.description,
              type: content.type,
              release_year: content.releaseYear,
              maturity_rating: content.maturityRating,
              poster_image: content.posterImage,
              backdrop_image: content.backdropImage,
              trailer_url: content.trailerUrl,
              featured: content.featured,
              subtitle_urls: content.subtitle_urls,
              master_url: content.master_url,
              master_url_480p: content.master_url_480p,
              master_url_720p: content.master_url_720p,
              master_url_1080p: content.master_url_1080p,
              video_url_480p: content.videoUrl480p,
              video_url_720p: content.videoUrl720p,
              video_url_1080p: content.videoUrl1080p,
              video_url_4k: content.videoUrl4k
            })
            .eq('id', id);

          if (contentError) throw contentError;

          // Update series data if applicable
          if (content.type === 'series' && content.seasons) {
            for (const season of content.seasons) {
              if (season.id) {
                // Update existing season
                const { error: seasonError } = await supabase
                  .from('seasons')
                  .update({
                    season_number: season.seasonNumber
                  })
                  .eq('id', season.id);

                if (seasonError) throw seasonError;

                // Update episodes
                if (season.episodes) {
                  for (const episode of season.episodes) {
                    if (episode.id) {
                      // Update existing episode
                      const { error: episodeError } = await supabase
                        .from('episodes')
                        .update({
                          episode_number: episode.episodeNumber,
                          title: episode.title,
                          duration: episode.duration,
                          master_url: episode.master_url,
                          master_url_480p: episode.master_url_480p,
                          master_url_720p: episode.master_url_720p,
                          master_url_1080p: episode.master_url_1080p,
                          video_url_480p: episode.videoUrl480p,
                          video_url_720p: episode.videoUrl720p,
                          video_url_1080p: episode.videoUrl1080p,
                          video_url_4k: episode.videoUrl4k,
                          subtitle_urls: episode.subtitle_urls,
                          thumbnail: episode.thumbnail
                        })
                        .eq('id', episode.id);

                      if (episodeError) throw episodeError;
                    } else {
                      // Add new episode
                      const { error: newEpisodeError } = await supabase
                        .from('episodes')
                        .insert({
                          season_id: season.id,
                          episode_number: episode.episodeNumber,
                          title: episode.title,
                          duration: episode.duration,
                          master_url: episode.master_url,
                          master_url_480p: episode.master_url_480p,
                          master_url_720p: episode.master_url_720p,
                          master_url_1080p: episode.master_url_1080p,
                          video_url_480p: episode.videoUrl480p,
                          video_url_720p: episode.videoUrl720p,
                          video_url_1080p: episode.videoUrl1080p,
                          video_url_4k: episode.videoUrl4k,
                          subtitle_urls: episode.subtitle_urls,
                          thumbnail: episode.thumbnail
                        });

                      if (newEpisodeError) throw newEpisodeError;
                    }
                  }
                }
              } else {
                // Add new season
                const { data: newSeason, error: newSeasonError } = await supabase
                  .from('seasons')
                  .insert({
                    series_id: id,
                    season_number: season.seasonNumber
                  })
                  .select()
                  .single();

                if (newSeasonError) throw newSeasonError;
                if (!newSeason) throw new Error('Failed to create new season');

                // Add episodes for new season
                if (season.episodes && season.episodes.length > 0) {
                  const episodeInserts = season.episodes.map((episode: any) => ({
                    season_id: newSeason.id,
                    episode_number: episode.episodeNumber,
                    title: episode.title,
                    duration: episode.duration,
                    master_url: episode.master_url,
                    master_url_480p: episode.master_url_480p,
                    master_url_720p: episode.master_url_720p,
                    master_url_1080p: episode.master_url_1080p,
                    video_url_480p: episode.videoUrl480p,
                    video_url_720p: episode.videoUrl720p,
                    video_url_1080p: episode.videoUrl1080p,
                    video_url_4k: episode.videoUrl4k,
                    subtitle_urls: episode.subtitle_urls,
                    thumbnail: episode.thumbnail
                  }));

                  const { error: episodesError } = await supabase
                    .from('episodes')
                    .insert(episodeInserts);

                  if (episodesError) throw episodesError;
                }
              }
            }
          }

          // Update genres if provided
          if (content.genre) {
            // Remove existing genre relations
            const { error: deleteGenresError } = await supabase
              .from('content_genres')
              .delete()
              .eq('content_id', id);

            if (deleteGenresError) throw deleteGenresError;

            // Add new genre relations
            const { data: genres, error: genresError } = await supabase
              .from('genres')
              .select('id, name')
              .in('name', content.genre);

            if (genresError) throw genresError;
            if (genres && genres.length > 0) {
              const genreRelations = genres.map(genre => ({
                content_id: id,
                genre_id: genre.id
              }));

              const { error: insertGenresError } = await supabase
                .from('content_genres')
                .insert(genreRelations);

              if (insertGenresError) throw insertGenresError;
            }
          }

          // Remove old cast links
          await supabase.from('content_cast').delete().eq('content_id', id);
          // Add new cast links
          if (content.cast && content.cast.length > 0) {
            for (let i = 0; i < content.cast.length; i++) {
              const member = content.cast[i];
              const upsertObj =
                member.id && member.id.length === 36
                  ? { id: member.id, name: member.name, photo_url: member.photoUrl }
                  : { name: member.name, photo_url: member.photoUrl };
              const { data: castMember, error: castMemberError } = await supabase
                .from('cast_members')
                .upsert(upsertObj, { onConflict: 'name' })
                .select()
                .single();
              if (castMemberError) throw castMemberError;
              const { error: contentCastError } = await supabase
                .from('content_cast')
                .insert({
                  content_id: id,
                  cast_member_id: castMember.id,
                  role: member.role,
                  order: i
                });
              if (contentCastError) throw contentCastError;
            }
          }

          // Refresh content list
          await get().fetchContents();
        } catch (error) {
          console.error('Error updating content:', error);
          throw error;
        }
      },

      deleteContent: async (id) => {
        try {
          const { error } = await supabase
            .from('content')
            .delete()
            .eq('id', id);

          if (error) throw error;
          
          set(state => ({
            contents: state.contents.filter(content => content.id !== id)
          }));
        } catch (error) {
          console.error('Error deleting content:', error);
          throw error;
        }
      },

      addSeason: async (contentId: string, season: Omit<Season, 'id' | 'episodes'>) => {
        try {
          const { data: newSeason, error } = await supabase.rpc('create_season', {
            p_content_id: contentId,
            p_season_number: season.seasonNumber,
            p_title: season.title || `Season ${season.seasonNumber}`,
            p_description: season.description || null
          });
          if (error) throw error;
          await get().fetchContents();
          return {
            id: newSeason,
            seasonNumber: season.seasonNumber,
            seriesId: contentId,
            episodes: [],
            title: season.title,
            description: season.description
          } as Season;
        } catch (error) {
          console.error('Error adding season:', error);
          throw error;
        }
      },

      updateSeason: async (seasonId, season) => {
        try {
          const { error } = await supabase
            .from('seasons')
            .update({
              season_number: season.seasonNumber
            })
            .eq('id', seasonId);

          if (error) throw error;
          await get().fetchContents();
        } catch (error) {
          console.error('Error updating season:', error);
          throw error;
        }
      },

      deleteSeason: async (seasonId) => {
        try {
          const { error } = await supabase
            .from('seasons')
            .delete()
            .eq('id', seasonId);

          if (error) throw error;
          await get().fetchContents();
        } catch (error) {
          console.error('Error deleting season:', error);
          throw error;
        }
      },

      addEpisode: async (seasonId: string, episode: Omit<Episode, 'id'>) => {
        try {
          const { data: newEpisode, error } = await supabase.rpc('create_episode', {
            p_season_id: seasonId,
            p_episode_number: episode.episodeNumber,
            p_title: episode.title,
            p_description: episode.description || '',
            p_duration: episode.duration || '',
            p_thumbnail: episode.thumbnail,
            p_video_url_480p: episode.videoUrl480p,
            p_video_url_720p: episode.videoUrl720p,
            p_video_url_1080p: episode.videoUrl1080p,
            p_video_url_4k: episode.videoUrl4k,
            p_master_url: episode.master_url,
            p_master_url_480p: episode.master_url_480p,
            p_master_url_720p: episode.master_url_720p,
            p_master_url_1080p: episode.master_url_1080p,
            p_subtitle_urls: episode.subtitle_urls
          });
          if (error) throw error;
          await get().fetchContents();
          return { id: newEpisode, ...episode };
        } catch (error) {
          console.error('Error adding episode:', error);
          throw error;
        }
      },

      updateEpisode: async (episodeId: string, episode: Partial<Episode>) => {
        try {
          const { error } = await supabase
            .from('episodes')
            .update({
              episode_number: episode.episodeNumber,
              title: episode.title,
              duration: episode.duration,
              master_url: episode.master_url,
              master_url_480p: episode.master_url_480p,
              master_url_720p: episode.master_url_720p,
              master_url_1080p: episode.master_url_1080p,
              video_url_480p: episode.videoUrl480p,
              video_url_720p: episode.videoUrl720p,
              video_url_1080p: episode.videoUrl1080p,
              video_url_4k: episode.videoUrl4k,
              subtitle_urls: episode.subtitle_urls,
              thumbnail: episode.thumbnail
            })
            .eq('id', episodeId);
          if (error) throw error;
          await get().fetchContents();
        } catch (error) {
          console.error('Error updating episode:', error);
          throw error;
        }
      },

      deleteEpisode: async (episodeId: string) => {
        try {
          const { error } = await supabase
            .from('episodes')
            .delete()
            .eq('id', episodeId);
          if (error) throw error;
          await get().fetchContents();
        } catch (error) {
          console.error('Error deleting episode:', error);
          throw error;
        }
      }
    }),
    {
      name: 'cinewave-content-storage',
      partialize: (state) => ({ myList: state.myList }),
    }
  )
);
