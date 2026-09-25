// Generates a Sales Invoice PDF matching the layout of the business's
// existing invoice template (title, seller/bill-to columns, item table,
// payment information block with bank details, notes, signature line).
// Client-side only (react-pdf), same pattern as financialsPdf.jsx.
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#1a1a1a" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700 },
  company: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { fontSize: 9.5, marginBottom: 1 },
  ruleThick: { borderBottom: "2pt solid #1a1a1a", marginVertical: 10 },
  columns: { flexDirection: "row", gap: 24, marginBottom: 12 },
  column: { flex: 1 },
  blockHeading: { fontSize: 10.5, fontWeight: 700, marginBottom: 5, textTransform: "uppercase" },
  fieldLine: { fontSize: 9.5, marginBottom: 2 },
  fieldLabel: { fontWeight: 700 },
  sectionHeading: { fontSize: 10.5, fontWeight: 700, marginTop: 4, marginBottom: 6, textTransform: "uppercase" },
  table: { marginTop: 2 },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1pt solid #1a1a1a", paddingBottom: 4, marginBottom: 2 },
  tableRow: { flexDirection: "row", borderBottom: "0.5pt solid #dddddd", paddingVertical: 4 },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.3, textAlign: "right" },
  colAmount: { flex: 1.3, textAlign: "right" },
  th: { fontSize: 8.5, fontWeight: 700, color: "#555555", textTransform: "uppercase" },
  paymentRow: { marginTop: 16, flexDirection: "row", gap: 24 },
  payCol: { flex: 1 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  totalsLabel: { fontSize: 9.5 },
  totalsValue: { fontSize: 9.5, textAlign: "right" },
  totalsStrong: { fontWeight: 700, fontSize: 10.5 },
  totalsDivider: { borderTop: "0.5pt solid #999999", marginTop: 3, paddingTop: 4 },
  notes: { marginTop: 16, fontSize: 9, lineHeight: 1.4, color: "#333333" },
  notesHeading: { fontSize: 10, fontWeight: 700, marginBottom: 3 },
  signRow: { marginTop: 26, flexDirection: "row", justifyContent: "space-between" },
  signLine: { fontSize: 9, color: "#333333" },
  sorNotice: { marginTop: 6, marginBottom: 10, fontSize: 9, color: "#7a4b00", backgroundColor: "#fdf3e0", padding: 8, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#999999", textAlign: "center", borderTop: "0.5pt solid #eeeeee", paddingTop: 6 },
});

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export function InvoiceDocument({ branding, invoiceSettings, money, order, customer, lineItems, subtotal, vatAmount, vatRate, total, paid, balance, isOpenSaleOrReturn, generatedAt }) {
  const seller = invoiceSettings || {};
  const docTitle = isOpenSaleOrReturn ? "DELIVERY NOTE — SALE OR RETURN" : "SALES INVOICE";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>{docTitle}</Text>
            <Text style={styles.company}>{branding?.name || "Business"}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>Invoice Number: {order.invoiceNumber || "—"}</Text>
            <Text style={styles.metaLine}>Invoice Date: {fmtDate(order.date)}</Text>
            <Text style={styles.metaLine}>Due Date: {order.dueDate ? fmtDate(order.dueDate) : (seller.dueTerms || "On Receipt")}</Text>
          </View>
        </View>
        <View style={styles.ruleThick} />

        {isOpenSaleOrReturn && (
          <Text style={styles.sorNotice}>
            These goods are shipped on a Sale-or-Return basis. No amount is billed until the sale is closed — this document confirms what left with the customer, not an amount due.
          </Text>
        )}

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.blockHeading}>Seller Information</Text>
            <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Business Name: </Text>{branding?.name || ""}</Text>
            {seller.address ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Address: </Text>{seller.address}</Text> : null}
            {seller.phone ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Phone: </Text>{seller.phone}</Text> : null}
            {seller.email ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Email: </Text>{seller.email}</Text> : null}
            {seller.taxId ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Tax ID: </Text>{seller.taxId}</Text> : null}
          </View>
          <View style={styles.column}>
            <Text style={styles.blockHeading}>Bill To</Text>
            <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Customer Name: </Text>{customer?.name || "—"}</Text>
            {customer?.segment ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Segment: </Text>{customer.segment}{customer.subCategory ? ` · ${customer.subCategory}` : ""}</Text> : null}
            {order.branch ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Branch: </Text>{order.branch}</Text> : null}
            {(customer?.city || customer?.state) ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Address: </Text>{[customer?.city, customer?.state].filter(Boolean).join(", ")}</Text> : null}
            {customer?.phone ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Phone: </Text>{customer.phone}</Text> : null}
            {customer?.email ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Email: </Text>{customer.email}</Text> : null}
          </View>
        </View>

        <Text style={styles.sectionHeading}>Invoice Details</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDesc]}>Item Description</Text>
            <Text style={[styles.th, styles.colQty]}>Quantity</Text>
            <Text style={[styles.th, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          {lineItems.map((it, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{it.name}{it.isGiveaway ? " (giveaway)" : ""}</Text>
              <Text style={styles.colQty}>{it.quantity}</Text>
              <Text style={styles.colPrice}>{it.isGiveaway ? "—" : money(it.unitPrice)}</Text>
              <Text style={styles.colAmount}>{it.isGiveaway ? "—" : money(it.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.paymentRow}>
          <View style={styles.payCol}>
            <Text style={styles.blockHeading}>Payment Information</Text>
            <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Payment Method: </Text>{seller.paymentMethod || "—"}</Text>
            {seller.bankName ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Bank Name: </Text>{seller.bankName}</Text> : null}
            {seller.accountName ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Account Name: </Text>{seller.accountName}</Text> : null}
            {seller.accountNumber ? <Text style={styles.fieldLine}><Text style={styles.fieldLabel}>Account Number: </Text>{seller.accountNumber}</Text> : null}
          </View>
          <View style={styles.payCol}>
            {isOpenSaleOrReturn ? (
              <>
                <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Goods value (reference)</Text><Text style={styles.totalsValue}>{money(subtotal)}</Text></View>
                <View style={[styles.totalsRow, styles.totalsDivider]}><Text style={[styles.totalsLabel, styles.totalsStrong]}>Amount Due</Text><Text style={[styles.totalsValue, styles.totalsStrong]}>Pending — not yet closed</Text></View>
              </>
            ) : (
              <>
                <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Subtotal</Text><Text style={styles.totalsValue}>{money(subtotal)}</Text></View>
                <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Tax/VAT ({vatRate || 0}%)</Text><Text style={styles.totalsValue}>{money(vatAmount)}</Text></View>
                <View style={[styles.totalsRow, styles.totalsDivider]}><Text style={[styles.totalsLabel, styles.totalsStrong]}>Total Amount Due</Text><Text style={[styles.totalsValue, styles.totalsStrong]}>{money(total)}</Text></View>
                <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Amount Paid</Text><Text style={styles.totalsValue}>{money(paid)}</Text></View>
                <View style={styles.totalsRow}><Text style={[styles.totalsLabel, styles.totalsStrong]}>Balance Due</Text><Text style={[styles.totalsValue, styles.totalsStrong]}>{money(balance)}</Text></View>
              </>
            )}
          </View>
        </View>

        {seller.notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesHeading}>Notes</Text>
            <Text>{seller.notes}</Text>
          </View>
        ) : null}

        <View style={styles.signRow}>
          <Text style={styles.signLine}>Authorized Signature: ......................................</Text>
          <Text style={styles.signLine}>Date: ......................................</Text>
        </View>

        <Text style={styles.footer}>Generated by {branding?.name || "Fabrica"} on {generatedAt}</Text>
      </Page>
    </Document>
  );
}

export async function downloadInvoicePdf(props) {
  const generatedAt = new Date().toLocaleString();
  const doc = <InvoiceDocument {...props} generatedAt={generatedAt} />;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = props.fileName || `${props.order?.invoiceNumber || "invoice"}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
