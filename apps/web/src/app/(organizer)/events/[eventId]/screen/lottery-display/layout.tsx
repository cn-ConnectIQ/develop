export default function LotteryDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#0a0a12]">
      {children}
    </div>
  );
}
