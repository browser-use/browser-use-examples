export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-[640px] w-full overflow-hidden border-t border-b border-dashed border-stone-400">
      {children}
    </div>
  );
}
