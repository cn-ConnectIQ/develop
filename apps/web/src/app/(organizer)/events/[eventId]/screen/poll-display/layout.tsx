export default function PollDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#12121e]">
      {children}
    </div>
  );
}
