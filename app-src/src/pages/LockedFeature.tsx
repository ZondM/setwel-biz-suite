import React from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '../components/common/ui';

export default function LockedFeature({ feature, requiredTier }: { feature: string; requiredTier: string }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={<Lock size={40} />}
      title={`${feature} is part of ${requiredTier}`}
      description={`Upgrade your plan to unlock ${feature.toLowerCase()} and everything else included in the ${requiredTier} package.`}
      action={<Button onClick={() => navigate('/upgrade')}>See upgrade options</Button>}
    />
  );
}
