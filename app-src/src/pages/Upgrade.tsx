import React from 'react';
import { Check, X } from 'lucide-react';
import { PACKAGES } from '../core/packages';
import { Button, Card, PageHeader } from '../components/common/ui';
import { useApp } from '../state/AppContext';
import { updateCompany } from '../db/repository';
import { PackageTier } from '../core/types';
import { buyUrl, openExternal } from '../core/licence';
import { formatDate } from '../core/numbering';

export default function Upgrade() {
  const { company, licence, bumpRefresh } = useApp();
  const licensed = licence?.mode === 'licensed';

  // During the free trial the customer may try any plan. Once paid, the licence decides.
  function tryTier(tier: PackageTier) {
    if (!company || licensed || tier === company.packageTier) return;
    updateCompany(company.id, { packageTier: tier });
    bumpRefresh();
  }

  return (
    <div>
      <PageHeader
        title={licensed ? 'Your plan' : 'Choose your plan'}
        subtitle={
          licensed
            ? `Licence ${licence?.key ?? ''}${licence?.paidUntil ? `, paid up to ${formatDate(licence.paidUntil)}` : ''}. To change plan, buy the new one and enter its key.`
            : 'You are on a free trial. Try any plan below, then buy the one that fits.'
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {PACKAGES.map((pkg) => {
          const isCurrent = company?.packageTier === pkg.tier;
          return (
            <Card key={pkg.tier} className={`flex flex-col gap-3 ${isCurrent ? 'border-brand-green ring-2 ring-brand-green' : ''}`}>
              <div>
                <div className="font-display font-bold text-brand-navy">{pkg.name}</div>
                <div className="text-xs text-gray-400 mb-2">{pkg.tagline}</div>
                <div className="font-display text-xl font-extrabold text-brand-green mb-1">{pkg.priceMonthly}</div>
                <div className="text-xs text-gray-400 mb-3">{pkg.priceYearly}</div>
                <ul className="space-y-1.5 text-xs text-gray-600 mb-2">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex gap-1.5">
                      <Check size={14} className="text-brand-green shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {pkg.notIncluded.map((f) => (
                    <li key={f} className="flex gap-1.5 text-gray-400">
                      <X size={14} className="shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto flex flex-col gap-2">
                {!licensed && !isCurrent && (
                  <Button variant="secondary" size="sm" onClick={() => tryTier(pkg.tier)}>
                    Try this plan
                  </Button>
                )}
                {licensed && isCurrent ? (
                  <Button variant="secondary" size="sm" disabled>
                    Your plan
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => openExternal(buyUrl(pkg.tier))}>
                    {isCurrent ? 'Buy this plan' : licensed ? 'Upgrade to this plan' : 'Buy this plan'}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
