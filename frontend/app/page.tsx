import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen p-6 flex items-center justify-center bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Merhaba Efe 👋</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Hukuk çalışma uygulaması iskeleti çalışıyor.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
