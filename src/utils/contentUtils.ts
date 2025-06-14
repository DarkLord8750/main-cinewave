import { Content, CastMember } from '../types/content';

interface ScoredContent {
  content: Content;
  score: number;
}

/**
 * Finds similar content based on title, genre, and actor matches
 * @param contentId - ID of the current content
 * @param allContent - Array of all available content
 * @returns Array of similar content items, limited to 10 results
 */
export function findSimilarContent(contentId: string, allContent: Content[]): Content[] {
  // Find current content
  const currentContent = allContent.find(c => c.id === contentId);
  if (!currentContent) return [];

  // Filter out current content
  const otherContent = allContent.filter(c => c.id !== contentId);
  if (otherContent.length === 0) return [];

  // Calculate similarity scores
  const scoredContent: ScoredContent[] = otherContent.map(content => {
    let score = 0;

    // Title similarity (3 points per matching word)
    const currentTitleWords = new Set(currentContent.title.toLowerCase().split(/\s+/));
    const contentTitleWords = content.title.toLowerCase().split(/\s+/);
    score += contentTitleWords.filter((word: string) => currentTitleWords.has(word)).length * 3;

    // Genre similarity (2 points per matching genre)
    const currentGenres = new Set(currentContent.genre);
    score += content.genre.filter((genre: string) => currentGenres.has(genre)).length * 2;

    // Actor similarity (1 point per matching actor)
    if (currentContent.cast && content.cast) {
      const currentActors = new Set(currentContent.cast.map((actor: CastMember) => actor.id));
      score += content.cast.filter((actor: CastMember) => currentActors.has(actor.id)).length;
    }

    return { content, score };
  });

  // Group content by score
  const contentByScore = scoredContent.reduce((acc, { content, score }) => {
    if (!acc[score]) acc[score] = [];
    acc[score].push(content);
    return acc;
  }, {} as Record<number, Content[]>);

  // Get all scores in descending order
  const scores = Object.keys(contentByScore)
    .map(Number)
    .sort((a, b) => b - a);

  // If no matches found (all scores are 0), return random items
  if (scores[0] === 0) {
    return shuffleArray(otherContent).slice(0, 10);
  }

  // Collect results, shuffling items with the same score
  const results: Content[] = [];
  for (const score of scores) {
    const items = shuffleArray(contentByScore[score]);
    results.push(...items);
    if (results.length >= 10) break;
  }

  return results.slice(0, 10);
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns Shuffled array
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
} 