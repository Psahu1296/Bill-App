interface StaffSummaryCardsProps {
  totalStaff: number;
  activeCount: number;
  monthlyExpense: number;
  paidToday: number;
}

const StaffSummaryCards: React.FC<StaffSummaryCardsProps> = ({
  totalStaff, activeCount, monthlyExpense, paidToday,
}) => (
  <div className="grid grid-cols-4 gap-4 mb-6">
    <div className="glass-card rounded-2xl p-5">
      <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">Total Staff</p>
      <p className="font-display text-2xl font-bold text-dhaba-text">{totalStaff}</p>
    </div>
    <div className="glass-card rounded-2xl p-5">
      <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">Active</p>
      <p className="font-display text-2xl font-bold text-dhaba-success">{activeCount}</p>
    </div>
    <div className="glass-card rounded-2xl p-5">
      <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">Monthly Expense</p>
      <p className="font-display text-2xl font-bold text-dhaba-accent">₹{monthlyExpense.toLocaleString()}</p>
    </div>
    <div className="glass-card rounded-2xl p-5">
      <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">Paid Today</p>
      <p className="font-display text-2xl font-bold text-dhaba-orange">₹{paidToday.toLocaleString()}</p>
    </div>
  </div>
);

export default StaffSummaryCards;
