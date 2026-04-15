import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useRoomId() {
  const [params] = useSearchParams();

  return useMemo(() => params.get('room')?.trim() || 'estaca1', [params]);
}
