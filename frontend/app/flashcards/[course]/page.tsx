import { getFlashcardsByCourse } from "@/lib/flashcards";
import FlashcardReviewClient from "./FlashcardReviewClient";
import { notFound } from "next/navigation";

export default async function FlashcardCoursePage({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  const courseId = (await params).course;
  const flashcards = await getFlashcardsByCourse(courseId);

  if (!flashcards || flashcards.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <FlashcardReviewClient courseId={courseId} flashcards={flashcards} />
      </div>
    </div>
  );
}
