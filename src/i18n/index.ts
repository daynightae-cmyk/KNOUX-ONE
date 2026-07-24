import { useKnoux } from '../context/KnouxContext';

export function useTranslation() {
  const { t, language } = useKnoux();
  return { t, language };
}
