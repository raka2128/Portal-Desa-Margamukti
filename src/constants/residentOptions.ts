import type { Resident } from '../types';

export const FAMILY_RELATIONSHIP_OPTIONS = [
  'Kepala keluarga',
  'Istri',
  'Suami',
  'Anak',
  'Cucu',
  'Menantu',
  'Famili Lain',
  'Mertua',
  'Orang Tua',
  'Lainnya',
] as const;

export const EDUCATION_OPTIONS = [
  'Tidak sekolah',
  'Belum tamat SD/Sederajat',
  'Tamat SD/Sederajat',
  'SLTP/Sederajat',
  'SLTA/Sederajat',
  'Akademi/D-III/S-Muda',
  'Strata 1',
  'Strata II',
  'Strata III',
] as const;

export const PHYSICAL_DISABILITY_OPTIONS = ['Tidak Ada', 'Ada'] as const;

export const DEATH_CAUSE_OPTIONS = ['Sakit', 'Kecelakaan', 'Faktor Usia', 'Lainnya'] as const;

export const DEATH_LOCATION_OPTIONS = ['Rumah', 'Rumah Sakit', 'Lainnya'] as const;

export const INDONESIAN_DAYS = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export const INDONESIAN_MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
] as const;

export function getIndonesianDayFromDate(dateStr: string): string {
  if (!dateStr) return 'Senin';
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!Number.isNaN(dt.getTime())) {
      return INDONESIAN_DAYS[dt.getDay()] || 'Senin';
    }
  }
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return 'Senin';
  return INDONESIAN_DAYS[dt.getDay()] || 'Senin';
}

const RELATIONSHIP_ORDER: Record<string, number> = {
  'kepala keluarga': 1,
  suami: 2,
  istri: 3,
  anak: 4,
  menantu: 5,
  cucu: 6,
  'orang tua': 7,
  mertua: 8,
  'famili lain': 9,
  lainnya: 10,
};

export function sortFamilyMembers(members: Resident[]): Resident[] {
  return [...members].sort((a, b) => {
    const ra = RELATIONSHIP_ORDER[(a.family_relationship || 'lainnya').trim().toLowerCase()] ?? 99;
    const rb = RELATIONSHIP_ORDER[(b.family_relationship || 'lainnya').trim().toLowerCase()] ?? 99;
    if (ra !== rb) return ra - rb;
    return (a.birth_date || '').localeCompare(b.birth_date || '');
  });
}
