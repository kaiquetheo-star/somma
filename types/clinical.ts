/** End-of-Month Clinical Exit Interview — consumed for Month 2 load prescription */
export interface ClinicalExitInterview {
  average_rpe: number;
  perceived_fatigue: number;
  estimated_1rm_kg: number | null;
  submitted_at: string;
}

/** JSON trigger surfaced to UI when mesocycle week 4 requires review */
export interface ClinicalReviewTrigger {
  type: 'clinical_exit_interview';
  mesocycle_week: 4;
  required: true;
  title: string;
  description: string;
}
