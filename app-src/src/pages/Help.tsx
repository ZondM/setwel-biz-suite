import React from 'react';
import { MessageCircle, Mail, BookOpen } from 'lucide-react';
import { Card, PageHeader } from '../components/common/ui';

export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Help & support" subtitle="Get unstuck quickly." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <MessageCircle className="text-brand-green mb-2" size={22} />
          <h3 className="font-display font-bold text-brand-navy mb-1">WhatsApp support</h3>
          <p className="text-sm text-gray-500">Chat to our support team in plain language, no jargon. Available in English, isiZulu and Afrikaans.</p>
        </Card>
        <Card>
          <Mail className="text-brand-green mb-2" size={22} />
          <h3 className="font-display font-bold text-brand-navy mb-1">Email us</h3>
          <p className="text-sm text-gray-500">support@setwelafrica.co.za — we usually reply within one business day.</p>
        </Card>
        <Card>
          <BookOpen className="text-brand-green mb-2" size={22} />
          <h3 className="font-display font-bold text-brand-navy mb-1">Guides</h3>
          <p className="text-sm text-gray-500">Step-by-step guides for VAT201 submission, recording your first invoice, and getting SARS-ready.</p>
        </Card>
      </div>
    </div>
  );
}
