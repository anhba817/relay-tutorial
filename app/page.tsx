import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background font-sans">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-10 py-32 px-16 sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <span className="rounded-full border border-border bg-card px-4 py-1 text-sm text-muted-foreground">
            relay-tutorial
          </span>
          <h1 className="max-w-md text-3xl font-semibold tracking-tight text-foreground">
            Building <span className="text-primary">Relay</span>
          </h1>
          <p className="max-w-md text-lg leading-8 text-muted-foreground">
            The application for the <em className="font-serif">Building Relay</em>{" "}
            tutorial series — a real-time chat infrastructure platform, built
            from an empty directory. Themed with{" "}
            <code className="font-mono text-sm text-accent-foreground">
              violet-bloom
            </code>
            .
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button>Get started</Button>
          <Button variant="outline">Read the docs</Button>
        </div>
      </main>
    </div>
  );
}
