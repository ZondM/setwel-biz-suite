import { transaction } from './database';
import * as repo from './repository';
import { calculateDocumentTotals } from '../core/financialEngine';
import { addDays, todayIso, uid } from '../core/numbering';
import { LineItem } from '../core/types';

function makeItems(rows: { description: string; quantity: number; unitPrice: number; vatApplicable?: boolean }[]): LineItem[] {
  return rows.map((r) => ({
    id: uid('li_'),
    description: r.description,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    vatApplicable: r.vatApplicable ?? true,
    lineTotal: Math.round(r.quantity * r.unitPrice * 100) / 100
  }));
}

/** Seeds a realistic small electrical-services business so a first-time user has something to explore. */
export function seedDemoData(companyId: string) {
  repo.ensureDefaultCategories(companyId);
  const categories = repo.listCategories(companyId);
  const materialsCategory = categories.find((c) => c.name.includes('materials'))!;
  const fuelCategory = categories.find((c) => c.name.includes('Fuel'))!;
  const rentCategory = categories.find((c) => c.name === 'Rent')!;
  const phoneCategory = categories.find((c) => c.name.includes('Telephone'))!;

  transaction(() => {
    const customers = [
      repo.saveCustomer({ companyId, name: 'Dlamini Family Trust', email: 'sipho.dlamini@gmail.com', phone: '082 345 6712', address: '14 Vilakazi Street, Soweto', isVatRegistered: false }),
      repo.saveCustomer({ companyId, name: 'Soweto Spaza Hub (Pty) Ltd', email: 'accounts@sowetospaza.co.za', phone: '011 555 0192', address: '7 Klipspruit Valley Rd, Soweto', isVatRegistered: true, vatNumber: '4480112233' }),
      repo.saveCustomer({ companyId, name: 'Naidoo Residence', email: 'r.naidoo@outlook.com', phone: '083 221 4456', address: '22 Lenasia Drive, Lenasia', isVatRegistered: false }),
      repo.saveCustomer({ companyId, name: 'Thuto Primary School', email: 'admin@thutoprimary.edu.za', phone: '011 987 6543', address: '5 Education Ave, Orlando East', isVatRegistered: false })
    ];

    const suppliers = [
      repo.saveSupplier({ companyId, name: 'City Electrical Wholesalers', email: 'sales@cityelectrical.co.za', phone: '011 444 2200', vatNumber: '4220098871' }),
      repo.saveSupplier({ companyId, name: 'Sasol Garage - Jabulani', phone: '011 333 1190' }),
      repo.saveSupplier({ companyId, name: 'Vodacom Business', email: 'support@vodacom.co.za', phone: '082 111 1111', vatNumber: '4660055443' })
    ];

    const today = todayIso();

    // Paid invoice 1
    const items1 = makeItems([
      { description: 'Replace distribution board (DB) - 12 way', quantity: 1, unitPrice: 2400 },
      { description: 'COC (Certificate of Compliance) inspection', quantity: 1, unitPrice: 850 },
      { description: 'Labour - 4 hours', quantity: 4, unitPrice: 350 }
    ]);
    const t1 = calculateDocumentTotals(items1);
    const inv1 = repo.saveInvoice({
      id: uid('inv_'),
      companyId,
      customerId: customers[0].id,
      invoiceNumber: repo.getNextInvoiceNumber(companyId, 'INV'),
      invoiceDate: addDays(today, -38),
      dueDate: addDays(today, -8),
      status: 'sent',
      items: items1,
      ...t1,
      amountPaid: 0,
      customerVatRegistered: customers[0].isVatRegistered
    });
    repo.recordPayment({ companyId, invoiceId: inv1.id, amount: t1.total, paymentDate: addDays(today, -30), method: 'eft', reference: 'EFT38821' });

    // Paid invoice 2
    const items2 = makeItems([
      { description: 'Install 3-phase plug for industrial fridge', quantity: 1, unitPrice: 1800 },
      { description: 'Cable - 4mm twin & earth (per metre)', quantity: 25, unitPrice: 42 }
    ]);
    const t2 = calculateDocumentTotals(items2);
    const inv2 = repo.saveInvoice({
      id: uid('inv_'),
      companyId,
      customerId: customers[1].id,
      invoiceNumber: repo.getNextInvoiceNumber(companyId, 'INV'),
      invoiceDate: addDays(today, -20),
      dueDate: addDays(today, 10),
      status: 'sent',
      items: items2,
      ...t2,
      amountPaid: 0,
      customerVatRegistered: customers[1].isVatRegistered
    });
    repo.recordPayment({ companyId, invoiceId: inv2.id, amount: t2.total, paymentDate: addDays(today, -16), method: 'snapscan' });

    // Overdue, unpaid invoice
    const items3 = makeItems([
      { description: 'Fault finding - tripping main breaker', quantity: 2, unitPrice: 350 },
      { description: 'Replace faulty earth leakage unit', quantity: 1, unitPrice: 620 }
    ]);
    const t3 = calculateDocumentTotals(items3);
    repo.saveInvoice({
      id: uid('inv_'),
      companyId,
      customerId: customers[2].id,
      invoiceNumber: repo.getNextInvoiceNumber(companyId, 'INV'),
      invoiceDate: addDays(today, -50),
      dueDate: addDays(today, -20),
      status: 'overdue',
      items: items3,
      ...t3,
      amountPaid: 0,
      customerVatRegistered: customers[2].isVatRegistered
    });

    // Partially paid invoice
    const items4 = makeItems([
      { description: 'Rewire classroom block - Phase 1', quantity: 1, unitPrice: 8500 },
      { description: 'Emergency lighting units', quantity: 6, unitPrice: 480 }
    ]);
    const t4 = calculateDocumentTotals(items4);
    const inv4 = repo.saveInvoice({
      id: uid('inv_'),
      companyId,
      customerId: customers[3].id,
      invoiceNumber: repo.getNextInvoiceNumber(companyId, 'INV'),
      invoiceDate: addDays(today, -12),
      dueDate: addDays(today, 18),
      status: 'sent',
      items: items4,
      ...t4,
      amountPaid: 0,
      customerVatRegistered: customers[3].isVatRegistered
    });
    repo.recordPayment({ companyId, invoiceId: inv4.id, amount: Math.round(t4.total * 0.4 * 100) / 100, paymentDate: addDays(today, -5), method: 'eft', reference: 'Deposit' });

    // A draft quote awaiting decision
    const qItems = makeItems([
      { description: 'Full home rewire - 3 bedroom house', quantity: 1, unitPrice: 18500 },
      { description: 'New 24-way distribution board', quantity: 1, unitPrice: 3200 }
    ]);
    const qt = calculateDocumentTotals(qItems);
    repo.saveQuote({
      id: uid('quo_'),
      companyId,
      customerId: customers[2].id,
      quoteNumber: repo.getNextQuoteNumber(companyId, 'QUO'),
      quoteDate: addDays(today, -3),
      validUntil: addDays(today, 27),
      status: 'sent',
      items: qItems,
      ...qt,
      customerVatRegistered: customers[2].isVatRegistered
    });

    // Expenses
    const expenseRows: { description: string; amount: number; categoryId: string; vatApplicable: boolean; daysAgo: number; supplierId?: string }[] = [
      { description: 'Cable, conduit and breakers - monthly stock', amount: 4200, categoryId: materialsCategory.id, vatApplicable: true, daysAgo: 25, supplierId: suppliers[0].id },
      { description: 'Diesel for bakkie', amount: 1450, categoryId: fuelCategory.id, vatApplicable: true, daysAgo: 14, supplierId: suppliers[1].id },
      { description: 'Workshop rent - this month', amount: 3500, categoryId: rentCategory.id, vatApplicable: false, daysAgo: 28 },
      { description: 'Business cellphone contract', amount: 699, categoryId: phoneCategory.id, vatApplicable: true, daysAgo: 9, supplierId: suppliers[2].id },
      { description: 'Distribution boards and circuit breakers', amount: 2900, categoryId: materialsCategory.id, vatApplicable: true, daysAgo: 6, supplierId: suppliers[0].id }
    ];
    for (const e of expenseRows) {
      const { vatAmount } = e.vatApplicable
        ? { vatAmount: Math.round(((e.amount * 0.15) / 1.15) * 100) / 100 }
        : { vatAmount: 0 };
      repo.saveExpense({
        companyId,
        supplierId: e.supplierId,
        categoryId: e.categoryId,
        description: e.description,
        amount: e.amount,
        vatApplicable: e.vatApplicable,
        vatAmount,
        expenseDate: addDays(today, -e.daysAgo)
      });
    }
  });
}
