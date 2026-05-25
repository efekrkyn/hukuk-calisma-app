import fs from 'fs';
import path from 'path';

export type QuizQuestion = {
  id: string;
  course: string;
  topic?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export async function getQuizQuestionsByCourse(courseId: string): Promise<QuizQuestion[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'questions', `${courseId}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    return data as QuizQuestion[];
  } catch (error) {
    console.error(`Failed to load quiz data for ${courseId}:`, error);
    return [];
  }
}

export async function getAllQuizQuestions(): Promise<QuizQuestion[]> {
  try {
    const questionsDir = path.join(process.cwd(), 'data', 'questions');
    const files = fs.readdirSync(questionsDir);
    let allQuestions: QuizQuestion[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const fileContent = fs.readFileSync(path.join(questionsDir, file), 'utf-8');
        const data = JSON.parse(fileContent) as QuizQuestion[];
        const courseId = file.replace('.json', '');
        // Inject course info
        const enrichedData = data.map(q => ({ ...q, course: courseId }));
        allQuestions = allQuestions.concat(enrichedData);
      }
    }
    
    return allQuestions;
  } catch (error) {
    console.error('Failed to load all quiz data:', error);
    return [];
  }
}
