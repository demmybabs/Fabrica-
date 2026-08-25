import { useApp } from "../lib/AppContext";
import Panel from "../components/Panel";

export default function CustomerPortal() {
  const { data } = useApp();

  return (
    <div className="space-y-6">
      <div>
        <div className="chip text-ink-400 uppercase">Module 05a</div>
        <h1 className="font-display text-xl font-semibold text-ink-50">My orders</h1>
      </div>

      <Panel title="Placeholder — needs real login" eyebrow="What a customer would see">
        <p className="text-sm text-ink-400 leading-relaxed">
          This is a stand-in for the customer-facing portal. Once accounts are wired
          to Supabase, a signed-in customer would land here and see only their own
          order history, current balance, and available products — enforced by the
          <code className="chip mx-1">customer_own_orders</code> row-level security
          policy in the schema, not by anything in this page. For now it's just a
          preview so the shape of the role is visible while switching roles in the
          sidebar.
        </p>
      </Panel>

      <Panel title="Product catalog" eyebrow="What a customer could browse and order">
        <div className="overflow-x-auto">
<table className="w-full text-sm" style={{minWidth: "600px"}}>
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Pack size</th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id} className="border-b border-ink-700/60 text-ink-200">
                <td className="py-2 pr-4">{p.name} · {p.flavor}</td>
                <td className="py-2 pr-4 chip">{p.packSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </Panel>
    </div>
  );
}
