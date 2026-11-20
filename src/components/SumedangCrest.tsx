export const SUMEDANG_CREST_URL = '/assets/aistudio/200_b0e37fdb.png';

export function SumedangCrest({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <img
      src={SUMEDANG_CREST_URL}
      alt="Lambang Kabupaten Sumedang - Insun Medal"
      className={`${className} object-contain`}
    />
  );
}
