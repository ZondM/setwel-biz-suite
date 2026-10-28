import React from 'react';
import { MessageCircle, Mail, BookOpen } from 'lucide-react';
import { Card, PageHeader } from '../components/common/ui';

export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Help & training" subtitle="Get unstuck quickly, or book setup and training with a Setwel partner accountant." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <MessageCircle className="text-brand-green mb-2" size={22} />
          <h3 className="font-display font-bold text-brand-navy mb-1">WhatsApp support</h3>
          <p className="text-sm text-gray-500">Chat to our support team in plain language, no jargon. Available in English, isiZulu and Afrikaans.</p>
        </Card>
        <Card>
          <Mail className="text-brand-green mb-2" size={22} />
          <h3 className="font-display font-bold text-brand-navy mb-1">Email us</h3>
          <p className="text-sm text-gray-500">support@setwelbusiness.co.za, or WhatsApp 082 082 9050. We usually reply within one business day.</p>
        </Card>
        <Card>
          <BookOpen className="text-brand-green mb-2" size={22} />
          <h3 className="font-display font-bold text-brand-navy mb-1">Guides</h3>
          <p className="text-sm text-gray-500 mb-3">The Setwel training manual: every screen step by step, with exercises. Print it or keep it open while you work.</p>
          <a href="https://setwelbusiness.co.za/manual.html" target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-green underline">Open the training manual</a>
          <a href="https://setwelbusiness.co.za/find-an-accountant.html" target="_blank" rel="noreferrer" className="block mt-2 text-sm font-semibold text-brand-green underline">Find a Setwel partner accountant</a>
        </Card>
      </div>
    </div>
  );
}
