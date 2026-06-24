export const STUB_USER_ID = "97feb076-9e1f-4a89-91b3-2d24b6231842";
export const STUB_PATIENT_ID = "75794434-0bb6-4dd0-b1c7-c26b39a13f03";

export type CurrentUser = {
  userId: string;
  name: string;
  email: string;
};

export type CurrentPatient = {
  patientId: string;
  name: string;
  // IANA timezone for date-only fields (started_on, discontinued_on, etc.) per
  // design.md 9.6:2803 — "Patient's local timezone, not the user's." v1 stub
  // mirrors the seed in db/seed.ts; v1.5 reads from patients.timezone.
  timezone: string;
  // The user↔patient relationship label ("Father", "Mother", …) shown in the
  // patient-profile subtitle (design.md 6.10:1671). It's a property of the
  // account holder's link to the patient, not patient demographics, so it has
  // no home in the locked `patients` schema — it lives here as stub identity
  // alongside name/timezone. v1.5 reads it from the user↔patient join.
  relationship: string;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    userId: STUB_USER_ID,
    name: "Avi Sharma",
    email: "avi@arogya.local",
  };
}

export async function getCurrentPatient(): Promise<CurrentPatient> {
  return {
    patientId: STUB_PATIENT_ID,
    name: "Ramesh Sharma",
    timezone: "Asia/Kolkata",
    relationship: "Father",
  };
}