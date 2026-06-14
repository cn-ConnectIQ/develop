export default function ForbiddenPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background">
      <main className="text-center">
        <h1 className="text-6xl font-bold text-foreground">403</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          无权访问此页面
        </p>
      </main>
    </div>
  );
}
