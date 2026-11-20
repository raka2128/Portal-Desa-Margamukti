export type AdminPermission =
  | 'overview'
  | 'surat'
  | 'penduduk'
  | 'wilayah'
  | 'perangkat'
  | 'apbdes'
  | 'agenda'
  | 'berita'
  | 'umkm'
  | 'galeri'
  | 'peta'
  | 'pengaduan'
  | 'peringatan'
  | 'pengaturan'
  | 'lembaga'
  | 'wa_blaster'
  | 'ai_knowledge'
  | 'portofolio'
  | 'pembangunan';

export type UserRole = 'super_admin' | 'sub_admin' | 'ketua_rw' | 'ketua_rt';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole | string;
  permissions: AdminPermission[];
  officialId?: number | null;
  scopeDusun?: string;
  scopeRw?: string;
  scopeRt?: string;
  isActive?: boolean;
}

export interface ManagedUser {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  permissions: AdminPermission[];
  official_id: number | null;
  official_name?: string | null;
  official_position?: string | null;
  scope_dusun: string;
  scope_rw: string;
  scope_rt: string;
  is_active: number;
  created_at: string;
}

export interface VillageSettings {
  id: number;
  village_name: string;
  district_name: string;
  regency_name: string;
  province_name: string;
  postal_code: string;
  village_code: string;
  office_address: string;
  phone: string;
  whatsapp: string;
  facebook_url: string;
  instagram_url: string;
  email: string;
  service_hours: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image: string;
  vision: string;
  mission: string;
  history: string;
  head_name: string;
  head_nip: string;
  kop_line1: string;
  kop_line2: string;
  kop_line3: string;
  kop_address: string;
  map_center_lat: number;
  map_center_lng: number;
}

export interface VillageEvent {
  id: number;
  title: string;
  event_time: string;
  location: string;
  is_active: number;
  sort_order: number;
  created_at?: string;
}

export interface DusunBreakdown {
  dusun: string;
  rwCount: number;
  rtCount: number;
  residentCount: number;
  maleCount: number;
  femaleCount: number;
}

export interface OccupationBreakdown {
  occupation: string;
  count: number;
}

export interface AgeBreakdown {
  group: string;
  count: number;
}

export interface RwBreakdown {
  rw: string;
  dusun: string;
  residentCount: number;
  maleCount: number;
  femaleCount: number;
}

export interface ReligionBreakdown {
  religion: string;
  count: number;
}

export interface PopulationStats {
  totalResidents: number;
  maleCount: number;
  femaleCount: number;
  totalFamilies: number;
  totalDusun: number;
  totalRw: number;
  totalRt: number;
  dusunBreakdown: DusunBreakdown[];
  occupationBreakdown: OccupationBreakdown[];
  ageBreakdown: AgeBreakdown[];
  rwBreakdown: RwBreakdown[];
  religionBreakdown: ReligionBreakdown[];
  educationBreakdown?: Array<{ education: string; count: number }>;
  maritalBreakdown?: Array<{ status: string; count: number }>;
  disabilityBreakdown?: Array<{ status: string; count: number }>;
}

export interface ApbdesItem {
  id: number;
  fiscal_year: number;
  type: 'Pendapatan' | 'Belanja' | 'Pembiayaan';
  category: string;
  title: string;
  budget_amount: number;
  realized_amount: number;
  notes: string;
  created_at?: string;
}

export interface ApbdesPublicSummary {
  year: number;
  years: number[];
  totals: {
    pendapatanBudget: number;
    pendapatanRealized: number;
    belanjaBudget: number;
    belanjaRealized: number;
    pembiayaanBudget: number;
    pembiayaanRealized: number;
  };
  belanjaByCategory: Array<{ category: string; budget: number; realized: number }>;
  pendapatanByCategory: Array<{ category: string; budget: number; realized: number }>;
  pembiayaanByCategory: Array<{ category: string; budget: number; realized: number }>;
  items: ApbdesItem[];
}

export interface Region {
  id: number;
  dusun: string;
  kepala_dusun: string;
  kepala_dusun_phone?: string;
  blok: string;
  rw: string;
  rt: string;
  ketua_rw: string;
  ketua_rw_phone?: string;
  ketua_rt: string;
  ketua_rt_phone?: string;
  latitude: number | null;
  longitude: number | null;
}

export type ResidentMutationStatus =
  | 'aktif'
  | 'lahir'
  | 'pindah_masuk'
  | 'pindah_keluar'
  | 'meninggal';

export type ResidentVerificationStatus = 'verified' | 'pending' | 'rejected';

export interface Resident {
  id: number;
  nik: string;
  no_kk: string;
  full_name: string;
  birth_place: string;
  birth_date: string;
  gender: 'Laki-laki' | 'Perempuan';
  address: string;
  region_id: number | null;
  religion: string;
  occupation: string;
  marital_status: string;
  family_relationship?: string;
  father_name?: string;
  mother_name?: string;
  education?: string;
  physical_disability?: string;
  resident_status?: ResidentMutationStatus;
  mutation_date?: string;
  mutation_notes?: string;
  death_time?: string;
  death_day?: string;
  death_cause?: string;
  death_location?: string;
  death_reporter_name?: string;
  death_reporter_nik?: string;
  verification_status?: ResidentVerificationStatus;
  verification_note?: string;
  dusun?: string;
  blok?: string;
  rw?: string;
  rt?: string;
}

export interface ResidentAggregateCategoryRow {
  label: string;
  male: number;
  female: number;
  total: number;
}

export interface PopulationPyramidRow {
  bracket: string;
  male: number;
  female: number;
  total: number;
}

export interface ResidentAggregateReport {
  periodType: 'monthly' | 'annual';
  year: number;
  month: number | null;
  periodLabel: string;
  cutoffDate: string;
  totals: {
    totalResidents: number;
    maleCount: number;
    femaleCount: number;
    totalFamilies: number;
  };
  periodMutations: {
    lahir: number;
    pindah_masuk: number;
    pindah_keluar: number;
    meninggal: number;
  };
  byGender: ResidentAggregateCategoryRow[];
  byAgeGroup: ResidentAggregateCategoryRow[];
  byOccupation: ResidentAggregateCategoryRow[];
  byReligion: ResidentAggregateCategoryRow[];
  byEducation: ResidentAggregateCategoryRow[];
  byMaritalStatus: ResidentAggregateCategoryRow[];
  byPhysicalDisability: ResidentAggregateCategoryRow[];
  pyramid: PopulationPyramidRow[];
}

export interface ResidentMutationLog {
  id: number;
  resident_id: number | null;
  resident_nik: string;
  resident_name: string;
  region_label: string;
  action_type: 'create' | 'status_change';
  prev_status: string;
  prev_mutation_date: string;
  prev_mutation_notes: string;
  new_status: ResidentMutationStatus;
  new_mutation_date: string;
  new_mutation_notes: string;
  actor_user_id: number;
  actor_name: string;
  actor_role: string;
  actor_scope: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  verified_by_name: string;
  verification_note: string;
  verified_at: string | null;
  created_at: string;
}

export interface Official {
  id: number;
  name: string;
  position: string;
  nip: string;
  sort_order: number;
  photo_url: string;
  phone: string;
  bio: string;
  tte_status?: 'none' | 'pending' | 'approved' | 'revoked';
  tte_code?: string;
  tte_approved_by?: string;
  tte_approved_at?: string | null;
  can_sign_letters?: number;
}

export interface RequiredFieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'textarea';
}

export interface LetterTemplate {
  id: number;
  code: string;
  name: string;
  classification_code: string;
  description: string;
  body_template: string;
  required_fields: string;
  is_active: number;
}

export interface LetterRequest {
  id: number;
  tracking_code: string;
  template_id: number;
  template_name?: string;
  template_code?: string;
  classification_code?: string;
  letter_number: string;
  applicant_nik: string;
  applicant_name: string;
  birth_place: string;
  birth_date: string;
  gender: string;
  religion: string;
  occupation: string;
  marital_status: string;
  address: string;
  phone: string;
  purpose: string;
  extra_data: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string;
  approved_at: string | null;
  created_at: string;
  rendered_body?: string;
  signer_official_id?: number | null;
  signer_name?: string;
  signer_position?: string;
  signer_nip?: string;
  signer_tte_code?: string;
  use_digital_signature?: number;
}

export type ArticleMediaType = 'image' | 'video' | 'embed';
export type ArticleMediaPlatform = 'upload' | 'youtube' | 'tiktok' | 'instagram';

export interface ArticleMediaItem {
  id: string;
  type: ArticleMediaType;
  url: string;
  platform?: ArticleMediaPlatform;
  caption?: string;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  image_url: string;
  media_items?: ArticleMediaItem[] | string;
  author_name: string;
  published_at: string;
  is_published: number;
  comment_count?: number;
}

export interface UmkmProduct {
  id: number;
  business_name: string;
  product_name: string;
  category: string;
  owner_name: string;
  description: string;
  price: number;
  whatsapp: string;
  image_url: string;
  is_verified: number;
}

export interface GalleryItem {
  id: number;
  title: string;
  description: string;
  event_date: string;
  category: string;
  image_url: string;
}

export interface MapLocation {
  id: number;
  name: string;
  category: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface MapMarkerItem {
  id: number | string;
  name: string;
  category: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  sourceType?: 'location' | 'region';
  leaders?: {
    kepala_dusun?: string;
    ketua_rw?: string;
    ketua_rt?: string;
  };
}

export interface Complaint {
  id: number;
  sender_name: string;
  sender_contact: string;
  category: string;
  subject: string;
  message: string;
  status: 'baru' | 'diproses' | 'selesai';
  admin_reply: string;
  is_emergency?: number;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
}

export interface ArticleComment {
  id: number;
  article_id: number;
  article_title?: string;
  article_slug?: string;
  author_name: string;
  author_region: string;
  comment_text: string;
  admin_reply: string;
  status: 'published' | 'hidden';
  created_at: string;
}

export type EarlyWarningSeverity = 'darurat' | 'siaga' | 'waspada' | 'info';

export interface EarlyWarning {
  id: number;
  title: string;
  category: string;
  severity: EarlyWarningSeverity;
  affected_area: string;
  description: string;
  instruction: string;
  emergency_contact: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface BmkgForecastSlot {
  local_datetime: string;
  t: number;
  hu: number;
  weather_desc: string;
  ws: number;
  wd: string;
}

export interface BmkgEarthquake {
  tanggal: string;
  jam: string;
  dateTime: string;
  coordinates: string;
  lintang: string;
  bujur: string;
  magnitude: string;
  kedalaman: string;
  wilayah: string;
  potensi: string;
  dirasakan: string;
}

export interface BmkgLivePayload {
  fetchedAt: string;
  adm4: string;
  weather: {
    available: boolean;
    locationName?: string;
    current?: BmkgForecastSlot | null;
    upcoming?: BmkgForecastSlot[];
    error?: string;
  };
  earthquake: {
    available: boolean;
    data?: BmkgEarthquake | null;
    error?: string;
  };
}

export interface BackupArchive {
  id: number;
  filename: string;
  trigger_type: 'auto_weekly' | 'manual';
  week_key: string;
  residents_count: number;
  mutations_count: number;
  regions_count: number;
  templates_count: number;
  letters_count: number;
  file_size: number;
  checksum: string;
  created_by: string;
  created_at: string;
  file_exists?: boolean;
}

export interface BackupOverviewResponse {
  schedule: {
    enabled: boolean;
    scheduleLabel: string;
    retentionLimit: number;
    autoBackupCount: number;
    lastAutoBackupAt: string | null;
    nextScheduledLabel: string;
  };
  liveCounts: {
    residents: number;
    mutations: number;
    regions: number;
    templates: number;
    letters: number;
  };
  archives: BackupArchive[];
}

export type WaRoleGroup = 'perangkat' | 'kepala_dusun' | 'ketua_rw' | 'ketua_rt';

export interface WaRecipientContact {
  key: string;
  roleGroup: WaRoleGroup;
  roleLabel: string;
  name: string;
  jabatan: string;
  wilayah: string;
  dusun: string;
  rw: string;
  rt: string;
  rawPhone: string;
  normalizedPhone: string;
  hasValidPhone: boolean;
  sourceType: 'officials' | 'regions';
  sourceId: number;
}

export interface WaTemplate {
  id: number;
  title: string;
  category: string;
  content: string;
  status: 'draft' | 'active';
  created_at: string;
  updated_at: string;
}

export interface WaBlastRecipientItem {
  id: number;
  blast_id: number;
  recipient_key: string;
  name: string;
  role_label: string;
  role_group: WaRoleGroup;
  wilayah_label: string;
  phone: string;
  rendered_message: string;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  gateway_response: string;
  sent_at: string | null;
}

export interface WaBlastSession {
  id: number;
  title: string;
  message_template: string;
  delivery_mode: 'wa_me_queue' | 'gateway_api';
  target_summary: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: 'draft' | 'in_progress' | 'completed';
  created_by: string;
  created_at: string;
}

export interface WaGatewayStatus {
  configured: boolean;
  provider: string;
  providerLabel: string;
}

export type InstitutionSlug = 'bpd' | 'bumdesa' | 'lpm' | 'pkk';

export interface InstitutionMember {
  id: number;
  institution_id: number;
  name: string;
  position: string;
  phone: string;
  sort_order: number;
  notes: string;
}

export interface VillageInstitution {
  id: number;
  slug: InstitutionSlug;
  name: string;
  short_name: string;
  tagline: string;
  legal_basis: string;
  description: string;
  tupoksi: string[];
  office_location: string;
  contact_phone: string;
  is_active: number;
  members?: InstitutionMember[];
}

export type AiKnowledgeCategory =
  | 'DTSEN'
  | 'Bansos'
  | 'Adminduk'
  | 'Pemerintahan Daerah'
  | 'Pemerintahan Desa';

export interface AiKnowledgeEntry {
  id: number;
  category: AiKnowledgeCategory;
  title: string;
  keywords: string;
  summary: string;
  content: string;
  official_source: string;
  related_route: string;
  related_subtab: string;
  related_label: string;
  is_active: number;
  sort_order: number;
  updated_by: string;
  updated_at: string;
}

export interface AiChatSourceLink {
  title: string;
  uri: string;
}

export interface AiChatActionLink {
  label: string;
  route: string;
  subTab?: string;
}

export interface AiChatQuickTopic {
  id: string;
  category: AiKnowledgeCategory;
  title: string;
  description: string;
  prompts: string[];
  action?: AiChatActionLink;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
  sources?: AiChatSourceLink[];
  suggestedLinks?: AiChatActionLink[];
  error?: boolean;
}

export type PortfolioSectionType =
  | 'program_unggulan'
  | 'penghargaan'
  | 'sinergi'
  | 'potensi_unggulan';

export interface PortfolioSettings {
  id: number;
  portfolio_title: string;
  portfolio_subtitle: string;
  executive_summary: string;
  profile_narrative: string;
  demographic_narrative: string;
  synergy_narrative: string;
  idm_score: string;
  idm_status: string;
  sdgs_score: string;
  area_size: string;
  boundaries_north: string;
  boundaries_east: string;
  boundaries_south: string;
  boundaries_west: string;
  strategic_partners: string;
  closing_statement: string;
  updated_by: string;
  updated_at: string;
}

export interface PortfolioItem {
  id: number;
  section_type: PortfolioSectionType;
  title: string;
  category: string;
  year_label: string;
  issuer_or_partner: string;
  status_label: string;
  impact_summary: string;
  description: string;
  sort_order: number;
  is_published: number;
  updated_by?: string;
  updated_at?: string;
}

export interface VillageDevelopment {
  id: number;
  name: string;
  budget_amount: number;
  funding_source: string;
  volume: string;
  progress_percent: number;
  fiscal_year: number;
  executor: string;
  location_region: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string;
  description: string;
  is_published: number;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioPublicPayload {
  settings: VillageSettings;
  portfolioSettings: PortfolioSettings;
  stats: PopulationStats;
  officials: Official[];
  institutions: VillageInstitution[];
  apbdesSummary: {
    year: number;
    pendapatanBudget: number;
    pendapatanRealized: number;
    belanjaBudget: number;
    belanjaRealized: number;
  };
  itemsBySection: Record<PortfolioSectionType, PortfolioItem[]>;
  developments: VillageDevelopment[];
  developmentTotals: {
    totalProjects: number;
    completedProjects: number;
    ongoingProjects: number;
    totalBudget: number;
    avgProgress: number;
  };
}

export type HolidayCategory =
  | 'libur_nasional'
  | 'cuti_bersama'
  | 'peringatan_nasional'
  | 'daerah_desa';

export type GreetingTone = 'resmi' | 'religius' | 'nasional' | 'daerah' | 'duka';

export interface NationalHoliday {
  id: number;
  holiday_date: string;
  month_day: string;
  name: string;
  category: HolidayCategory;
  is_annual: number;
  is_official_holiday: number;
  description: string;
  default_greeting: string;
  is_active: number;
  projected_date?: string;
  custom_greeting?: VillageGreeting | null;
  created_at?: string;
  updated_at?: string;
}

export interface VillageGreeting {
  id: number;
  holiday_id: number | null;
  holiday_name?: string;
  moment_title: string;
  greeting_text: string;
  sender_label: string;
  theme_tone: GreetingTone;
  start_date: string;
  end_date: string;
  is_pinned: number;
  is_active: number;
  updated_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface ActiveGreetingItem {
  key: string;
  source: 'pinned' | 'custom_schedule' | 'auto_holiday' | 'upcoming_holiday';
  greetingId: number | null;
  holidayId: number | null;
  momentTitle: string;
  greetingText: string;
  senderLabel: string;
  themeTone: GreetingTone;
  dateLabel: string;
  categoryLabel: string;
  isPinned: boolean;
}

