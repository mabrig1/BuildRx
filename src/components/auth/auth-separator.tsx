export function AuthSeparator() {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-border h-px flex-1" />
      <span className="text-muted-foreground text-xs uppercase">or</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
