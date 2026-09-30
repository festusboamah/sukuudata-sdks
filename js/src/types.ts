export type SchoolLevel = "KG" | "PRIMARY" | "JHS" | "SHS" | "TVET";
export type SchoolGender = "MIXED" | "BOYS" | "GIRLS";
export type ResidentialType = "DAY" | "BOARDING" | "MIXED";
export type PlacementCategory = "A" | "B" | "C" | "PILOT_PRIVATE";
export type InstitutionType = "SHS" | "SHTS" | "TVET";
export type SpecialNeed = "VISUALLY_IMPAIRED" | "HEARING_IMPAIRED" | "LEARNING_DIFFICULTIES";
export type ProgrammeKind = "GENERAL" | "TVET";
export type StudentGender = "MALE" | "FEMALE";

/** A value, or several (sent comma-separated). */
export type OneOrMany<T extends string = string> = T | T[];

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  data: T[];
  pagination: Pagination;
}

export interface Programme {
  code: string;
  name: string;
  kind: ProgrammeKind;
  /** Present on GET /programmes. */
  schoolCount?: number;
}

export interface SecondaryProfile {
  /** 7-digit code used on the CSSPS selection form. */
  csspsCode: string;
  category: PlacementCategory;
  institutionType: InstitutionType;
  gender: SchoolGender;
  offersDay: boolean;
  offersBoarding: boolean;
  programmes: Programme[];
  specialNeeds: SpecialNeed[];
  /** Year of the GES register this came from. */
  registerYear: number;
  locationConfidence?: string | null;
}

export interface School {
  id: string;
  name: string;
  level: SchoolLevel | null;
  type: "Public" | "Private" | null;
  gender: SchoolGender | null;
  residentialType: ResidentialType | null;
  region: string;
  regionCode: string;
  district: string;
  districtCode: string;
  town: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  status: "ACTIVE" | "NEEDS_REVIEW";
  source: string;
  lastVerifiedAt: string;
  /** Placement data, for schools in the GES register; null otherwise. */
  secondary: SecondaryProfile | null;
  /** Straight-line distance, when the request gave a location. */
  distanceKm?: number;
}

export interface Region {
  id: number;
  name: string;
  code: string;
  pcode: string;
  schoolCount: number;
}

export interface District {
  id: number;
  name: string;
  code: string;
  pcode: string;
  region: string;
  regionCode: string;
  schoolCount: number;
}

interface SchoolFilters {
  /** Region code, pcode or name. */
  region?: OneOrMany;
  /** District code, pcode or name. */
  district?: OneOrMany;
  level?: OneOrMany<SchoolLevel>;
  /** "public" or "private". */
  type?: OneOrMany;
  gender?: OneOrMany<SchoolGender>;
  residential?: OneOrMany<ResidentialType>;
  status?: OneOrMany<"ACTIVE" | "NEEDS_REVIEW">;
  town?: string;
  /** Substring of the school name. */
  search?: string;
  hasLocation?: boolean;
}

export interface ListSchoolsParams extends SchoolFilters {
  sort?: string;
  page?: number;
  /** Up to 100 (default 20). */
  limit?: number;
}

export interface SearchSchoolsParams {
  region?: OneOrMany;
  level?: OneOrMany<SchoolLevel>;
  /** Up to 25 (default 10). */
  limit?: number;
}

export interface NearbySchoolsParams extends SchoolFilters {
  lat: number;
  lng: number;
  /** km, up to 300 (default 25). */
  radius?: number;
  limit?: number;
}

export interface ListSecondarySchoolsParams {
  region?: OneOrMany;
  district?: OneOrMany;
  search?: string;
  category?: OneOrMany<PlacementCategory>;
  institutionType?: OneOrMany<InstitutionType>;
  /** Programme code(s) the school must offer, e.g. "502". */
  programme?: OneOrMany;
  /** Only schools a student of this gender can attend. */
  studentGender?: StudentGender | "male" | "female";
  gender?: OneOrMany<SchoolGender>;
  residential?: OneOrMany<"DAY" | "BOARDING">;
  specialNeeds?: OneOrMany<SpecialNeed>;
  hasLocation?: boolean;
  lat?: number;
  lng?: number;
  radius?: number;
  /** name, -name, category, -category, or distance (needs lat/lng). */
  sort?: string;
  page?: number;
  limit?: number;
}

export interface PlacementRules {
  year: number;
  source: { title: string; publisher: string; url: string };
  totalChoices: number;
  maxBoardingChoices: number;
  maxDayChoices: number;
  categoryLimits: Record<string, { max: number; maxBoarding?: number; maxDay?: number }>;
  noRepeatedSchools: boolean;
  dayCatchmentKm: number;
  notes: string[];
}

export interface Choice {
  /** 7-digit CSSPS code. Give this or schoolId. */
  csspsCode?: string;
  schoolId?: string;
  /** Programme code, e.g. "502". */
  programme: string;
  residential: "DAY" | "BOARDING";
}

export interface ValidateChoicesInput {
  /** In order of preference. */
  choices: Choice[];
  studentGender?: StudentGender;
  /** Candidate's home, to check day schools are within reach. */
  home?: { lat: number; lng: number };
}

export interface ValidationIssue {
  /** e.g. CATEGORY_A_LIMIT, PROGRAMME_NOT_OFFERED, DAY_SCHOOL_FAR */
  code: string;
  message: string;
  /** 1-based choice the issue is about, if any. */
  choice?: number;
}

export interface CategoryCount {
  total: number;
  boarding: number;
  day: number;
}

export interface ValidationResult {
  /** True when there are no errors (warnings may remain). */
  valid: boolean;
  rulesYear: number;
  registerYear: number | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: CategoryCount & { byCategory: Record<PlacementCategory, CategoryCount> };
  choices: {
    choice: number;
    school: {
      id: string;
      name: string;
      csspsCode: string;
      category: PlacementCategory;
      region: string;
      district: string;
    } | null;
    programme: Programme | null;
    residential: "DAY" | "BOARDING";
    distanceKm: number | null;
  }[];
}

export interface SchoolStatistics {
  total: number;
  public: number;
  private: number;
  withLocation: number;
  byLevel: Partial<Record<SchoolLevel, number>>;
  placementSchoolsByCategory: Partial<Record<PlacementCategory, number>>;
}
