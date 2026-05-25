export type QuizQuestion = {
  id: string;
  course: string;
  topic: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

export async function getQuizQuestionsByCourse(courseId: string): Promise<QuizQuestion[]> {
  try {
    if (courseId === 'borclar_genel') {
      const data = await import('../data/questions/borclar_genel.json');
      return data.default as QuizQuestion[];
    }
    
    return [];
  } catch (error) {
    console.error(`Failed to load quiz data for ${courseId}:`, error);
    return [];
  }
}
