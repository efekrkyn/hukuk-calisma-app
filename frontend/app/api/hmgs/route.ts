import { NextResponse } from "next/server";
import { getAllQuizQuestions } from "@/lib/quiz";

export async function GET() {
  try {
    const allQuestions = await getAllQuizQuestions();
    
    // Shuffle the array using Fisher-Yates
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    // Take up to 20 questions for a mini HMGS
    const selectedQuestions = allQuestions.slice(0, 20);

    return NextResponse.json(selectedQuestions);
  } catch (error) {
    console.error("HMGS API error:", error);
    return NextResponse.json({ error: "Sınav oluşturulamadı." }, { status: 500 });
  }
}
