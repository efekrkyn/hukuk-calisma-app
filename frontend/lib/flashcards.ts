import fs from 'fs';
import path from 'path';

export interface Flashcard {
  id: string;
  course: string;
  front: string;
  back: string;
}

// In Next.js App Router (Server Components), we can read files directly using fs.
// We need to resolve the path relative to process.cwd() which is 'frontend' in dev,
// but in Vercel production it might be different. Let's try to find it.

export async function getFlashcardsByCourse(courseId: string): Promise<Flashcard[]> {
  try {
    // Attempt to dynamically import the JSON file. This allows Webpack to bundle it.
    // However, dynamic imports with variables can be tricky for bundlers.
    // Since we only have borclar_genel right now:
    if (courseId === 'borclar_genel') {
      const data = await import('../data/flashcards/borclar_genel.json');
      return data.default as Flashcard[];
    }
    
    // Fallback if we add more
    return [];
  } catch (error) {
    console.error(`Error loading flashcards for course ${courseId}:`, error);
    return [];
  }
}

export async function getAvailableCourses(): Promise<{id: string, name: string}[]> {
  // Mock available courses for flashcards
  return [
    { id: 'borclar_genel', name: 'Borçlar Hukuku Genel Hükümler' }
  ];
}
